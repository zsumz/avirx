import { createServer, type IncomingHttpHeaders, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

export type HttpTestRequest = Readonly<{
    headers: IncomingHttpHeaders;
    method: string;
    rawBody: string;
    receivedAt: number;
    url: URL;
}>;

export type HttpTestResponse = Readonly<{
    body?: string;
    delayMs?: number;
    fail?: 'close';
    headers?: HeadersInit;
    status?: number;
    statusText?: string;
}>;

export type HttpTestRouteHandler = (
    request: HttpTestRequest,
) => HttpTestResponse | Promise<HttpTestResponse>;

export type HttpTestServer = Readonly<{
    close(): Promise<void>;
    origin: string;
    requests: readonly HttpTestRequest[];
    route(method: string, path: string, handler: HttpTestRouteHandler): void;
    url(path?: string): string;
}>;

type RouteKey = `${string} ${string}`;

export async function startHttpTestServer(): Promise<HttpTestServer> {
    const routes: Map<RouteKey, HttpTestRouteHandler> = new Map();
    const requests: HttpTestRequest[] = [];

    const server = createServer((incoming, response) => {
        void handleRequest(incoming, response, routes, requests).catch((error: unknown) => {
            if (response.headersSent) {
                response.destroy(error instanceof Error ? error : undefined);
                return;
            }

            void writeResponse(response, httpJson({ code: 'handler_failed' }, { status: 500 }));
        });
    });

    await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => {
            server.off('error', reject);
            resolve();
        });
    });

    const address = server.address();
    if (!isAddressInfo(address)) {
        throw new TypeError('Expected HTTP test server to listen on a TCP address.');
    }

    const origin = `http://127.0.0.1:${String(address.port)}`;

    return Object.freeze({
        async close() {
            await new Promise<void>((resolve, reject) => {
                server.close((error) => {
                    if (error) {
                        reject(error);
                        return;
                    }

                    resolve();
                });
            });
        },
        origin,
        requests,
        route(method: string, path: string, handler: HttpTestRouteHandler) {
            routes.set(createRouteKey(method, path), handler);
        },
        url(path = '') {
            return new URL(path, origin).href;
        },
    });
}

export function httpJson(data: unknown, init: Omit<HttpTestResponse, 'body'> = {}): HttpTestResponse {
    const headers = new Headers(init.headers);
    if (!headers.has('content-type')) {
        headers.set('content-type', 'application/json');
    }

    return {
        ...init,
        body: JSON.stringify(data),
        headers,
    };
}

export function httpText(body: string, init: Omit<HttpTestResponse, 'body'> = {}): HttpTestResponse {
    const headers = new Headers(init.headers);
    if (!headers.has('content-type')) {
        headers.set('content-type', 'text/plain; charset=utf-8');
    }

    return {
        ...init,
        body,
        headers,
    };
}

export function httpEmpty(init: Omit<HttpTestResponse, 'body'> = {}): HttpTestResponse {
    return init;
}

async function handleRequest(
    incoming: IncomingMessage,
    response: ServerResponse,
    routes: ReadonlyMap<RouteKey, HttpTestRouteHandler>,
    requests: HttpTestRequest[],
): Promise<void> {
    const method = incoming.method ?? 'GET';
    const origin = `http://${incoming.headers.host ?? '127.0.0.1'}`;
    const url = new URL(incoming.url ?? '/', origin);
    const request = Object.freeze({
        headers: incoming.headers,
        method,
        rawBody: await readBody(incoming),
        receivedAt: Date.now(),
        url,
    });
    requests.push(request);

    const handler = routes.get(createRouteKey(method, url.pathname));
    const testResponse = handler
        ? await handler(request)
        : httpJson({ code: 'not_found' }, { status: 404, statusText: 'Not Found' });

    await writeResponse(response, testResponse);
}

async function readBody(incoming: IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];

        incoming.on('data', (chunk: Buffer) => {
            chunks.push(chunk);
        });
        incoming.on('error', reject);
        incoming.on('end', () => {
            resolve(Buffer.concat(chunks).toString('utf8'));
        });
    });
}

function isAddressInfo(address: ReturnType<ReturnType<typeof createServer>['address']>): address is AddressInfo {
    return typeof address === 'object' && address !== null && 'port' in address;
}

async function writeResponse(response: ServerResponse, testResponse: HttpTestResponse): Promise<void> {
    if (testResponse.delayMs !== undefined && testResponse.delayMs > 0) {
        await delay(testResponse.delayMs);
    }

    if (testResponse.fail === 'close') {
        response.destroy(new Error('Simulated connection failure.'));
        return;
    }

    const status = testResponse.status ?? 200;
    response.statusCode = status;

    if (testResponse.statusText) {
        response.statusMessage = testResponse.statusText;
    }

    if (testResponse.headers) {
        const headers = new Headers(testResponse.headers);
        headers.forEach((value, key) => {
            response.setHeader(key, value);
        });
    }

    response.end(testResponse.body);
}

function createRouteKey(method: string, path: string): RouteKey {
    return `${method.toUpperCase()} ${path}`;
}

async function delay(ms: number): Promise<void> {
    await new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}
