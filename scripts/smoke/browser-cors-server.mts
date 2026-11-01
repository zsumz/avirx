import type { IncomingMessage, ServerResponse } from 'node:http';

export function handleCorsBrowserRequest(request: IncomingMessage, response: ServerResponse): void {
    const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
    response.setHeader('access-control-allow-origin', '*');
    response.setHeader('cache-control', 'public, max-age=0');
    response.setHeader('content-type', 'text/plain');
    response.setHeader('vary', 'Accept-Language');
    if (pathname === '/exposed') {
        response.setHeader('access-control-expose-headers', 'Vary');
    }
    response.end(request.headers['accept-language'] ?? 'missing');
}
