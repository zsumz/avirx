import { afterEach, describe, expect, it } from 'vitest';

import { avirx } from 'avirx';

import {
    httpEmpty,
    httpJson,
    httpText,
    startHttpTestServer,
    type HttpTestServer,
} from '../helpers/http-server.js';

describe('real HTTP coverage', () => {
    let server: HttpTestServer | undefined;

    afterEach(async () => {
        await server?.close();
        server = undefined;
    });

    it('covers every MVP HTTP method through real fetch', async () => {
        server = await startHttpTestServer();
        for (const method of ['DELETE', 'GET', 'HEAD', 'OPTIONS', 'PATCH', 'POST', 'PUT']) {
            server.route(method, '/methods', () => httpEmpty({ status: 204, statusText: `${method} OK` }));
        }

        const client = avirx(server.origin);
        await client.delete('/methods').expect(204).send();
        await client.get('/methods').expect(204).send();
        await client.head('/methods').expect(204).send();
        await client.options('/methods').expect(204).send();
        await client.patch('/methods').expect(204).send();
        await client.post('/methods').expect(204).send();
        await client.put('/methods').expect(204).send();

        expect(server.requests.map((request) => request.method)).toEqual([
            'DELETE',
            'GET',
            'HEAD',
            'OPTIONS',
            'PATCH',
            'POST',
            'PUT',
        ]);
    });

    it('covers path interpolation, URI encoding, query arrays, and omitted nullish values', async () => {
        server = await startHttpTestServer();
        server.route('GET', '/encoded/a%20b/slash%2Fvalue', (request) =>
            httpJson({
                existing: request.url.searchParams.get('existing'),
                omitted: request.url.searchParams.has('omitted'),
                pathname: request.url.pathname,
                tags: request.url.searchParams.getAll('tag'),
            }),
        );

        const data = await avirx(server.origin)
            .get('/encoded/{name}/{value}?existing=1')
            .path({ name: 'a b', value: 'slash/value' })
            .query({ omitted: null, tag: ['api', 'paperback'] })
            .json<{
            existing: string;
            omitted: boolean;
            pathname: string;
            tags: string[];
        }>();

        expect(data).toEqual({
            existing: '1',
            omitted: false,
            pathname: '/encoded/a%20b/slash%2Fvalue',
            tags: ['api', 'paperback'],
        });
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

    it('covers download metadata and cache hits through real fetch', async () => {
        server = await startHttpTestServer();
        server.route('GET', '/exports/exp_123', () =>
            httpText('id,email\nusr_123,a@example.com\n', {
                headers: {
                    'content-disposition': 'attachment; filename*=UTF-8\'\'users%20export.csv',
                    'content-length': '31',
                    'content-type': 'text/csv',
                },
            }),
        );

        const client = avirx(server.origin).cache({ ttl: '1s' });
        const first = await client.get('/exports/{id}').path({ id: 'exp_123' }).download();
        const second = await client.get('/exports/{id}').path({ id: 'exp_123' }).download();

        expect(first.filename).toBe('users export.csv');
        expect(first.contentLength).toBe(31);
        expect(first.contentType).toBe('text/csv');
        await expect(first.blob.text()).resolves.toBe('id,email\nusr_123,a@example.com\n');
        await expect(second.blob.text()).resolves.toBe('id,email\nusr_123,a@example.com\n');
        expect(server.requests).toHaveLength(1);
    });

    it('covers multipart uploads through real fetch', async () => {
        server = await startHttpTestServer();
        server.route('POST', '/uploads', (request) =>
            httpJson(
                {
                    body: request.rawBody,
                    contentType: request.headers['content-type'],
                },
                { status: 201 },
            ),
        );

        const response = await avirx(server.origin)
            .post('/uploads')
            .multipart()
            .field('userId', 'usr_123')
            .file('avatar', new Blob(['avatar-bytes'], { type: 'text/plain' }), 'avatar.txt')
            .expect(201)
            .json<{ body: string; contentType: string }>();

        expect(response.contentType).toMatch(/^multipart\/form-data; boundary=/u);
        expect(response.body).toContain('name="userId"');
        expect(response.body).toContain('usr_123');
        expect(response.body).toContain('name="avatar"; filename="avatar.txt"');
        expect(response.body.toLowerCase()).toContain('content-type: text/plain');
        expect(response.body).toContain('avatar-bytes');
    });

    it('covers retry-after, rate limit, and concurrency composition through real fetch', async () => {
        server = await startHttpTestServer();
        let attempts = 0;
        server.route('GET', '/reports/rpt_123', () => {
            attempts += 1;
            if (attempts === 1) {
                return httpJson(
                    { code: 'busy' },
                    {
                        headers: { 'retry-after': '0' },
                        status: 429,
                    },
                );
            }

            return httpJson({ id: 'rpt_123', status: 'ready' });
        });

        const report = await avirx(server.origin)
            .rateLimit({ requests: 1, per: '10ms' })
            .concurrency(1)
            .retry({ attempts: 2, on: [429] })
            .get('/reports/{id}')
            .path({ id: 'rpt_123' })
            .json<{ id: string; status: string }>();

        expect(report).toEqual({ id: 'rpt_123', status: 'ready' });
        expect(server.requests).toHaveLength(2);
        expect(server.requests.map((request) => request.url.pathname)).toEqual([
            '/reports/rpt_123',
            '/reports/rpt_123',
        ]);
    });
});
