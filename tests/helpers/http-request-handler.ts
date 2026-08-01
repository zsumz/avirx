import type { IncomingMessage, ServerResponse } from 'node:http';
import { httpJson } from './http-responses.js';
import type {
    HttpTestRequest,
    HttpTestResponse,
    HttpTestRouteHandler,
    HttpTestRouteKey,
} from './http-types.js';

export async function handleHttpTestRequest(
    incoming: IncomingMessage,
    response: ServerResponse,
    routes: ReadonlyMap<HttpTestRouteKey, HttpTestRouteHandler>,
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

    const handler = routes.get(createHttpTestRouteKey(method, url.pathname));
    const testResponse = handler
        ? await handler(request)
        : httpJson({ code: 'not_found' }, { status: 404, statusText: 'Not Found' });
    await writeResponse(response, testResponse);
}

export function createHttpTestRouteKey(method: string, path: string): HttpTestRouteKey {
    return `${method.toUpperCase()} ${path}`;
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

async function writeResponse(
    response: ServerResponse,
    testResponse: HttpTestResponse,
): Promise<void> {
    if (testResponse.delayMs !== undefined && testResponse.delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, testResponse.delayMs));
    }
    if (testResponse.fail === 'close') {
        response.destroy(new Error('Simulated connection failure.'));
        return;
    }
    response.statusCode = testResponse.status ?? 200;
    if (testResponse.statusText) {
        response.statusMessage = testResponse.statusText;
    }
    if (testResponse.headers) {
        new Headers(testResponse.headers).forEach((value, key) => {
            response.setHeader(key, value);
        });
    }
    response.end(testResponse.body);
}
