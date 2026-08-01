import { afterEach, describe, expect, it } from 'vitest';
import { avirx } from 'avirx';
import { httpJson, httpText, startHttpTestServer, type HttpTestServer } from '../../helpers/http-server.js';

describe('real HTTP coverage', () => {
    let server: HttpTestServer | undefined;

    afterEach(async () => {
        await server?.close();
        server = undefined;
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
