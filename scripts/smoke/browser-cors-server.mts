import type { IncomingMessage, ServerResponse } from 'node:http';

export function createCorsBrowserHandler(): (request: IncomingMessage, response: ServerResponse) => void {
    let credentialCalls = 0;
    return (request, response) => {
        const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
        response.setHeader('access-control-allow-origin', '*');
        response.setHeader('access-control-allow-headers', 'x-custom-token, x-derived, authorization');
        response.setHeader('access-control-allow-methods', 'GET, OPTIONS');
        if (request.method === 'OPTIONS') {
            response.writeHead(204).end();
            return;
        }
        if (pathname === '/credential-target' || pathname === '/credential-count') {
            response.setHeader('cache-control', 'no-store');
            response.setHeader('content-type', 'application/json');
            if (pathname === '/credential-target') credentialCalls += 1;
            response.end(JSON.stringify(pathname === '/credential-count' ? { calls: credentialCalls } : {
                authorization: request.headers.authorization ?? null,
                token: request.headers['x-custom-token'] ?? null,
            }));
            return;
        }
        response.setHeader('cache-control', 'public, max-age=0');
        response.setHeader('content-type', 'text/plain');
        response.setHeader('vary', 'Accept-Language');
        if (pathname === '/exposed') {
            response.setHeader('access-control-expose-headers', 'Vary');
        }
        response.end(request.headers['accept-language'] ?? 'missing');
    };
}
