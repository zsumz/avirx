import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { expect, it } from 'vitest';
import { avirx } from 'avirx';

it('runs a native consumer workflow across refresh, upload, invalidation and streaming', async () => {
    let token = 'expired';
    const authorizations: Array<string | undefined> = [];
    let version = 1;
    let publicCalls = 0;
    let releasePublic!: () => void;
    let publicStarted!: () => void;
    const publicGate: Promise<void> = new Promise((resolve) => {
        releasePublic = resolve;
    });
    const started: Promise<void> = new Promise((resolve) => {
        publicStarted = resolve;
    });
    async function handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
        const path = new URL(request.url ?? '/', 'http://localhost').pathname;
        if (path === '/secure/') {
            authorizations.push(request.headers.authorization);
            json(response, { user: 'Ada' }, request.headers.authorization === 'Bearer fresh' ? 200 : 503);
        } else if (path === '/upload/') {
            let body = '';
            for await (const chunk of request) body += String(chunk);
            json(response, { body, contentType: request.headers['content-type'] }, 201);
        } else if (path === '/public/') {
            publicCalls += 1;
            const capturedVersion = version;
            if (publicCalls === 1) {
                publicStarted();
                await publicGate;
            }
            response.setHeader('cache-control', 'public, max-age=0');
            json(response, { version: capturedVersion });
        } else if (path === '/stream/') {
            response.writeHead(200, { 'content-type': 'text/plain' });
            response.write('ready');
        } else {
            json(response, { error: 'missing' }, 404);
        }
    }
    const server = createServer((request, response) => {
        void handle(request, response).catch(() => {
            response.destroy();
        });
    });
    await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => {
            server.off('error', reject); resolve();
        });
    });
    try {
        const address = server.address();
        if (address === null || typeof address === 'string') throw new Error('Expected TCP address.');
        const api = avirx(`http://127.0.0.1:${String(address.port)}`)
            .concurrency(2).rateLimit({ per: '1s', requests: 20 });
        const authenticated = api.auth.bearer(() => token).retry(1).on('retry', () => {
            token = 'fresh';
        });
        await expect(authenticated.get('/secure/').json()).resolves.toEqual({ user: 'Ada' });
        expect(authorizations).toEqual(['Bearer expired', 'Bearer fresh']);

        const upload = await api.post('/upload/').body({ obsolete: true })
            .multipart().field('name', 'Ada').file('file', new Blob(['file bytes']), 'sample.txt')
            .expect(201).json<{ body: string; contentType: string }>();
        expect(upload.contentType).toMatch(/^multipart\/form-data; boundary=/u);
        expect(upload.body).toContain('name="name"');
        expect(upload.body).toContain('file bytes');
        expect(upload.body).not.toContain('obsolete');

        const publicApi = api.cache({ ttl: '60s' });
        const oldRequest = publicApi.get('/public/').json();
        await started;
        publicApi.state.cache?.clear();
        version = 2;
        releasePublic();
        await expect(oldRequest).resolves.toEqual({ version: 1 });
        await expect(publicApi.get('/public/').json()).resolves.toEqual({ version: 2 });
        await expect(publicApi.get('/public/').json()).resolves.toEqual({ version: 2 });
        expect(publicCalls).toBe(2);

        const controller = new AbortController();
        const stream = await api.signal(controller.signal).get('/stream/').timeout('5s').send();
        const reader = stream.native.body?.getReader();
        expect((await reader?.read())?.done).toBe(false);
        controller.abort(new Error('Consumer finished.'));
        await expect(reader?.read()).rejects.toThrow();
        reader?.releaseLock();
    } finally {
        releasePublic();
        server.closeAllConnections();
        await new Promise<void>((resolve, reject) => {
            server.close((error) => {
                if (error) reject(error); else resolve();
            });
        });
    }
});

function json(response: ServerResponse, value: unknown, status = 200): void {
    response.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(value));
}
