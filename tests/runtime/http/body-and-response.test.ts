import { afterEach, describe, expect, it } from 'vitest';
import { avirx } from 'avirx';
import { httpEmpty, httpJson, httpText, startHttpTestServer, type HttpTestServer } from '../../helpers/http-server.js';

describe('real HTTP coverage', () => {
    let server: HttpTestServer | undefined;

    afterEach(async () => {
        await server?.close();
        server = undefined;
    });

    it('covers client headers, request headers, JSON body serialization, and content type behavior', async () => {
        server = await startHttpTestServer();
        server.route('POST', '/body', (request) =>
            httpJson(
                {
                    body: JSON.parse(request.rawBody) as unknown,
                    contentType: request.headers['content-type'],
                    clientHeader: request.headers['x-client'],
                    requestHeader: request.headers['x-request'],
                },
                {
                    headers: { 'x-body-response': 'yes' },
                    status: 201,
                    statusText: 'Created',
                },
            ),
        );

        const response = await avirx(server.origin)
            .header('X-Client', 'dashboard')
            .post('/body')
            .header('X-Request', 'req_123')
            .body({ ok: true })
            .expect(201)
            .send();
        const data = await response.native.clone().json() as {
            body: unknown;
            clientHeader: string;
            contentType: string;
            requestHeader: string;
        };

        expect(response.status).toBe(201);
        expect(response.statusText).toBe('Created');
        expect(response.headers['x-body-response']).toBe('yes');
        expect(data).toEqual({
            body: { ok: true },
            clientHeader: 'dashboard',
            contentType: 'application/json',
            requestHeader: 'req_123',
        });
    });

    it('covers JSON, text, 204, and 205 response parsing', async () => {
        server = await startHttpTestServer();
        server.route('GET', '/json', () => httpJson({ ok: true }));
        server.route('GET', '/text', () => httpText('ready'));
        server.route('GET', '/empty-204', () => httpEmpty({ status: 204, statusText: 'No Content' }));
        server.route('GET', '/empty-205', () => httpEmpty({ status: 205, statusText: 'Reset Content' }));

        await expect(avirx(server.origin).get('/json').json<{ ok: boolean }>()).resolves.toEqual({ ok: true });
        await expect(avirx(server.origin).get('/text').text()).resolves.toBe('ready');
        await expect(avirx(server.origin).get('/empty-204').json()).resolves.toBeUndefined();
        await expect(avirx(server.origin).get('/empty-205').json()).resolves.toBeUndefined();
    });

    it('covers response metadata from real fetch', async () => {
        server = await startHttpTestServer();
        server.route('GET', '/metadata', () =>
            httpJson(
                { ok: true },
                {
                    headers: { 'x-meta': 'yes' },
                    status: 202,
                    statusText: 'Accepted',
                },
            ),
        );

        const response = await avirx(server.origin)
            .get('/metadata')
            .expect(202)
            .send();

        expect(response.status).toBe(202);
        expect(response.statusText).toBe('Accepted');
        expect(response.url).toBe(server.url('/metadata'));
        expect(response.headers['x-meta']).toBe('yes');
        expect(response.timing.startedAt).toEqual(expect.any(Number));
        expect(response.timing.endedAt).toEqual(expect.any(Number));
        expect(response.timing.durationMs).toEqual(expect.any(Number));
    });
});
