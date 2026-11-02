import { describe, expect, it, vi } from 'vitest';
import { avirx, endpoint, type AvirxSchema } from 'avirx';
import { z } from 'zod';

describe('contract input and output', () => {
    it('accepts the input shape of transforming schemas', async () => {
        const fetchImpl = vi.fn<typeof fetch>(async () => Promise.resolve(new Response('{}')));
        const query = z.object({ limit: z.string().transform(Number) });
        const body: AvirxSchema<{ count: number }, { count: string }> = {
            parse(input) {
                return { count: Number(input.count) };
            },
        };
        const api = avirx('https://api.example.com', { fetch: fetchImpl }).contract({
            create: endpoint.post('/items').query(query).body(body),
        });

        await api.create({ body: { count: '3' }, query: { limit: '10' } });

        expect(fetchImpl).toHaveBeenCalledWith(
            new URL('https://api.example.com/items?limit=10'),
            expect.objectContaining({ body: '{"count":3}' }),
        );
    });

    it('awaits input schemas before constructing the request', async () => {
        const fetchImpl = vi.fn<typeof fetch>(async () => Promise.resolve(new Response('{"id":"123"}')));
        const api = avirx('https://api.example.com', { fetch: fetchImpl }).contract({
            update: endpoint.put('/items/{id}')
                .params({ parse: async (input: { id: number }) => Promise.resolve({ id: String(input.id) }) })
                .query({ parse: async (input: { limit: string }) => Promise.resolve({ limit: Number(input.limit) }) })
                .body({ parse: async (input: { count: string }) => Promise.resolve({ count: Number(input.count) }) })
                .returns({ parse: async (input: unknown) => Promise.resolve(input as { id: string }) }),
        });

        await expect(api.update({
            body: { count: '3' }, path: { id: 123 }, query: { limit: '10' },
        })).resolves.toEqual({ id: '123' });
        expect(fetchImpl).toHaveBeenCalledWith(
            new URL('https://api.example.com/items/123?limit=10'),
            expect.objectContaining({ body: '{"count":3}' }),
        );
    });

    it('preserves reserved contract names and path parameter keys', async () => {
        const fetchImpl = vi.fn<typeof fetch>(async () => Promise.resolve(new Response('{}')));
        const api = avirx('https://api.example.com', { fetch: fetchImpl }).contract({
            ['__proto__']: endpoint.get('/items/{__proto__}'),
        });

        await api.__proto__({ path: { ['__proto__']: 'expected' } });

        expect(Object.hasOwn(api, '__proto__')).toBe(true);
        expect(fetchImpl).toHaveBeenCalledWith(
            new URL('https://api.example.com/items/expected'), expect.any(Object),
        );
    });

    it('does not execute when an asynchronous input parser rejects', async () => {
        const cause = new TypeError('Expected query input.');
        const fetchImpl = vi.fn<typeof fetch>(async () => Promise.resolve(new Response('{}')));
        const api = avirx('https://api.example.com', { fetch: fetchImpl }).contract({
            search: endpoint.get('/items').query({
                async parse(): Promise<{ limit: number }> {
                    return Promise.reject(cause);
                },
            }),
        });

        await expect(api.search({ query: { limit: 10 } })).rejects.toBe(cause);
        await expect(api.search.result({ query: { limit: 10 } })).rejects.toBe(cause);
        expect(fetchImpl).not.toHaveBeenCalled();
    });

    it('returns successful bodyless HEAD data and exposes metadata in result mode', async () => {
        const fetchImpl = vi.fn<typeof fetch>(async () => Promise.resolve(new Response(null, {
            headers: { 'content-length': '17', etag: 'version-1' }, status: 200,
        })));
        const api = avirx('https://api.example.com', { fetch: fetchImpl }).contract({
            inspect: endpoint.head('/items'),
        });

        await expect(api.inspect({})).resolves.toBeUndefined();
        await expect(api.inspect.result({})).resolves.toMatchObject({
            data: undefined,
            ok: true,
            response: { headers: { etag: 'version-1' } },
            status: 200,
        });
    });
});
