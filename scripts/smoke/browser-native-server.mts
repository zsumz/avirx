import type { IncomingMessage, ServerResponse } from 'node:http';

export function createNativeBrowserHandler(): (
    request: IncomingMessage,
    response: ServerResponse,
) => boolean {
    let publicCalls = 0;
    return (request, response) => {
        const url = new URL(request.url ?? '/', 'http://localhost');
        if (!url.pathname.startsWith('/native/')) return false;
        if (url.pathname === '/native/login') {
            response.writeHead(200, {
                'cache-control': 'no-store',
                'set-cookie': `user=${url.searchParams.get('user') ?? 'anonymous'}; Path=/; SameSite=Lax; HttpOnly`,
            }).end();
        } else if (url.pathname === '/native/private') {
            const user = /(?:^|;\s*)user=([^;]+)/u.exec(request.headers.cookie ?? '')?.[1];
            response.writeHead(200, {
                'cache-control': 'private, no-store',
                'content-type': 'application/json',
            }).end(JSON.stringify({ user }));
        } else if (url.pathname === '/native/public') {
            publicCalls += 1;
            response.writeHead(200, {
                'cache-control': 'public, max-age=0',
                'content-type': 'application/json',
            }).end(JSON.stringify({ calls: publicCalls }));
        } else if (url.pathname === '/native/stream') {
            response.writeHead(200, { 'content-type': 'text/event-stream' });
            response.write('data: ready\n\n');
        } else {
            response.writeHead(404).end();
        }
        return true;
    };
}
