import { afterEach, describe, expect, it } from 'vitest';
import { avirx } from 'avirx';
import { httpEmpty, httpJson, startHttpTestServer, type HttpTestServer } from '../../helpers/http-server.js';

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
            .query({ omitted: null, tag: ['fiction', 'paperback'] })
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
            tags: ['fiction', 'paperback'],
        });
    });
});
