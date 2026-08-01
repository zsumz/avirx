import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import {
    createHttpTestRouteKey,
    handleHttpTestRequest,
} from './http-request-handler.js';
import { httpJson } from './http-responses.js';
import type {
    HttpTestRequest,
    HttpTestRouteHandler,
    HttpTestRouteKey,
    HttpTestServer,
} from './http-types.js';

export { httpEmpty, httpJson, httpText } from './http-responses.js';
export type {
    HttpTestRequest,
    HttpTestResponse,
    HttpTestRouteHandler,
    HttpTestServer,
} from './http-types.js';

export async function startHttpTestServer(): Promise<HttpTestServer> {
    const routes: Map<HttpTestRouteKey, HttpTestRouteHandler> = new Map();
    const requests: HttpTestRequest[] = [];
    const server = createServer((incoming, response) => {
        void handleHttpTestRequest(incoming, response, routes, requests).catch((error: unknown) => {
            if (response.headersSent) {
                response.destroy(error instanceof Error ? error : undefined);
                return;
            }
            response.statusCode = 500;
            response.setHeader('content-type', 'application/json');
            response.end(httpJson({ code: 'handler_failed' }).body);
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
                    } else {
                        resolve();
                    }
                });
            });
        },
        origin,
        requests,
        route(method, path, handler) {
            routes.set(createHttpTestRouteKey(method, path), handler);
        },
        url(path = '') {
            return new URL(path, origin).href;
        },
    });
}

function isAddressInfo(
    address: ReturnType<ReturnType<typeof createServer>['address']>,
): address is AddressInfo {
    return typeof address === 'object' && address !== null && 'port' in address;
}
