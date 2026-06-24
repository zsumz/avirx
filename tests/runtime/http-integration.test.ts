import { afterEach, describe, expect, it } from 'vitest';

import { avirx } from 'avirx';

import {
    httpEmpty,
    httpJson,
    httpText,
    startHttpTestServer,
    type HttpTestServer,
} from '../helpers/http-server.js';

describe('HTTP integration harness', () => {
    let server: HttpTestServer | undefined;

    afterEach(async () => {
        await server?.close();
        server = undefined;
    });

    it('executes Avirx through real fetch and records the received request', async () => {
        server = await startHttpTestServer();
        server.route('POST', '/v1/users/usr%20123', (request) =>
            httpJson(
                {
                    body: JSON.parse(request.rawBody) as unknown,
                    method: request.method,
                    requestId: request.headers['x-request-id'],
                    tags: request.url.searchParams.getAll('tag'),
                },
                {
                    headers: { 'x-test-response': 'yes' },
                    status: 202,
                    statusText: 'Accepted',
                },
            ),
        );

        const response = await avirx(server.url('/v1'))
            .post('/users/{id}?existing=1')
            .path({ id: 'usr 123' })
            .query({ omitted: undefined, tag: ['a', 'b'] })
            .header('X-Request-Id', 'req_123')
            .body({ ok: true })
            .expect(202)
            .send();
        const data = await response.native.clone().json() as {
            body: unknown;
            method: string;
            requestId: string;
            tags: string[];
        };

        expect(response.status).toBe(202);
        expect(response.statusText).toBe('Accepted');
        expect(response.headers['x-test-response']).toBe('yes');
        expect(data).toEqual({
            body: { ok: true },
            method: 'POST',
            requestId: 'req_123',
            tags: ['a', 'b'],
        });
        expect(server.requests).toHaveLength(1);
        expect(server.requests[0]).toMatchObject({
            method: 'POST',
            rawBody: '{"ok":true}',
        });
        expect(server.requests[0]?.url.pathname).toBe('/v1/users/usr%20123');
        expect(server.requests[0]?.url.searchParams.get('existing')).toBe('1');
        expect(server.requests[0]?.headers['content-type']).toBe('application/json');
    });

    it('supports text and empty responses with custom status codes', async () => {
        server = await startHttpTestServer();
        server.route('GET', '/health', () =>
            httpText('ready', {
                headers: { 'x-health': 'ok' },
            }),
        );
        server.route('DELETE', '/books/book_123', () =>
            httpEmpty({
                status: 204,
                statusText: 'No Content',
            }),
        );

        await expect(avirx(server.origin).get('/health').text()).resolves.toBe('ready');

        const response = await avirx(server.origin)
            .delete('/books/{id}')
            .path({ id: 'book_123' })
            .expect(204)
            .send();

        expect(response.status).toBe(204);
        expect(response.statusText).toBe('No Content');
        expect(server.requests.map((request) => `${request.method} ${request.url.pathname}`)).toEqual([
            'GET /health',
            'DELETE /books/book_123',
        ]);
    });
});
