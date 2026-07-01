import { afterEach, describe, expect, it, vi } from 'vitest';

import { avirx, endpoint } from 'avirx';

describe('cache policy', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it('caches GET success responses with fresh readable bodies', async () => {
        const fetchImpl = vi.fn<typeof fetch>(async () =>
            Promise.resolve(new Response(JSON.stringify({ count: 1 }), {
                headers: { 'content-type': 'application/json' },
            })),
        );
        const client = avirx('https://api.example.com', { fetch: fetchImpl }).cache({ ttl: '1s' });

        const first = await client.get('/stats').json<{ count: number }>();
        const second = await client.get('/stats').json<{ count: number }>();
        const responseA = await client.get('/stats').send();
        const responseB = await client.get('/stats').send();

        expect(first).toEqual({ count: 1 });
        expect(second).toEqual({ count: 1 });
        await expect(responseA.native.text()).resolves.toBe(JSON.stringify({ count: 1 }));
        await expect(responseB.native.text()).resolves.toBe(JSON.stringify({ count: 1 }));
        expect(fetchImpl).toHaveBeenCalledOnce();
        expect(client.state.cache?.size()).toBe(1);
    });

    it('caches download terminal responses', async () => {
        const fetchImpl = vi.fn<typeof fetch>(async () =>
            Promise.resolve(new Response('export', {
                headers: {
                    'content-disposition': 'attachment; filename="export.txt"',
                    'content-type': 'text/plain',
                },
            })),
        );
        const client = avirx('https://api.example.com', { fetch: fetchImpl }).cache({ ttl: '1s' });

        const first = await client.get('/exports/latest').download();
        const second = await client.get('/exports/latest').download();

        await expect(first.blob.text()).resolves.toBe('export');
        await expect(second.blob.text()).resolves.toBe('export');
        expect(second.filename).toBe('export.txt');
        expect(fetchImpl).toHaveBeenCalledOnce();
    });

    it('skips caching responses larger than maxBytes', async () => {
        const fetchImpl = vi
            .fn<typeof fetch>()
            .mockResolvedValueOnce(new Response('large', {
                headers: { 'content-length': '5' },
            }))
            .mockResolvedValueOnce(new Response('ok', {
                headers: { 'content-length': '2' },
            }));
        const client = avirx('https://api.example.com', { fetch: fetchImpl }).cache({
            maxBytes: 2,
            ttl: '1s',
        });

        await expect(client.get('/stats').text()).resolves.toBe('large');
        await expect(client.get('/stats').text()).resolves.toBe('ok');
        await expect(client.get('/stats').text()).resolves.toBe('ok');

        expect(fetchImpl).toHaveBeenCalledTimes(2);
        expect(client.state.cache?.size()).toBe(1);
    });

    it('skips caching unknown-size responses when maxBytes is configured', async () => {
        const fetchImpl = vi
            .fn<typeof fetch>()
            .mockResolvedValueOnce(new Response('ok'))
            .mockResolvedValueOnce(new Response('fresh'));
        const client = avirx('https://api.example.com', { fetch: fetchImpl }).cache({
            maxBytes: 2,
            ttl: '1s',
        });

        await expect(client.get('/stats').text()).resolves.toBe('ok');
        await expect(client.get('/stats').text()).resolves.toBe('fresh');

        expect(fetchImpl).toHaveBeenCalledTimes(2);
        expect(client.state.cache?.size()).toBe(0);
    });

    it('skips caching download responses larger than maxBytes', async () => {
        const fetchImpl = vi.fn<typeof fetch>(async () =>
            Promise.resolve(new Response('export', {
                headers: {
                    'content-disposition': 'attachment; filename="export.txt"',
                    'content-type': 'text/plain',
                },
            })),
        );
        const client = avirx('https://api.example.com', { fetch: fetchImpl }).cache({
            maxBytes: 3,
            ttl: '1s',
        });

        const first = await client.get('/exports/latest').download();
        const second = await client.get('/exports/latest').download();

        await expect(first.blob.text()).resolves.toBe('export');
        await expect(second.blob.text()).resolves.toBe('export');
        expect(fetchImpl).toHaveBeenCalledTimes(2);
        expect(client.state.cache?.size()).toBe(0);
    });

    it('keys cache entries by final URL and configured vary headers', async () => {
        const fetchImpl = vi.fn<typeof fetch>(async (input, init) =>
            Promise.resolve(new Response(JSON.stringify({
                language: new Headers(init?.headers).get('accept-language'),
                url: fetchInputUrl(input).href,
            }))),
        );
        const client = avirx('https://api.example.com', { fetch: fetchImpl }).cache({
            ttl: '1s',
            vary: ['accept-language'],
        });

        await client.get('/users').query({ page: 1 }).header('accept-language', 'en').json();
        await client.get('/users').query({ page: 1 }).header('accept-language', 'en').json();
        await client.get('/users').query({ page: 2 }).header('accept-language', 'en').json();
        await client.get('/users').query({ page: 1 }).header('accept-language', 'fr').json();

        expect(fetchImpl).toHaveBeenCalledTimes(3);
    });

    it('shares cache state across cloned clients', async () => {
        const fetchImpl = vi.fn<typeof fetch>(async () => Promise.resolve(new Response('shared')));
        const base = avirx('https://api.example.com', { fetch: fetchImpl }).cache({ ttl: '1s' });
        const clone = base.header('x-client', 'clone');

        await base.get('/catalog').text();
        await clone.get('/catalog').text();

        expect(fetchImpl).toHaveBeenCalledOnce();
        expect(base.state.cache).toBe(clone.state.cache);
    });

    it('does not use cache for build, preview, or curl inspection', async () => {
        const fetchImpl = vi.fn<typeof fetch>(async () => Promise.resolve(new Response('live')));
        const client = avirx('https://api.example.com', { fetch: fetchImpl }).cache({ ttl: '1s' });

        await client.get('/inspect').build();
        await client.get('/inspect').preview();
        await client.get('/inspect').curl();

        expect(fetchImpl).not.toHaveBeenCalled();

        await client.get('/inspect').text();
        await client.get('/inspect').text();

        expect(fetchImpl).toHaveBeenCalledOnce();
    });

    it('bypasses cache for authenticated requests', async () => {
        const fetchImpl = vi.fn<typeof fetch>(async () => Promise.resolve(new Response('private')));
        const bearer = avirx('https://api.example.com', { fetch: fetchImpl })
            .cache({ ttl: '1s' })
            .auth.bearer(() => 'token');
        const queryAuth = avirx('https://api.example.com', { fetch: fetchImpl })
            .cache({ ttl: '1s' })
            .auth.query('api_key', () => 'secret');

        await bearer.get('/me').text();
        await bearer.get('/me').text();
        await queryAuth.get('/me').text();
        await queryAuth.get('/me').text();

        expect(fetchImpl).toHaveBeenCalledTimes(4);
    });

    it.each(['X-Auth-Token', 'Private-Token', 'X-Custom-Key'] as const)(
        'bypasses cache for auth-created custom API key header %s',
        async (headerName) => {
            let token = 'a';
            let count = 0;
            const fetchImpl = vi.fn<typeof fetch>(async (_input, init) => {
                const headers = new Headers(init?.headers);
                count += 1;
                return Promise.resolve(new Response(JSON.stringify({
                    count,
                    token: headers.get(headerName),
                })));
            });
            const client = avirx('https://api.example.com', { fetch: fetchImpl })
                .auth.apiKey(headerName, () => token)
                .cache({ ttl: '1s' });

            await expect(client.get('/me').json()).resolves.toEqual({ count: 1, token: 'a' });
            token = 'b';
            await expect(client.get('/me').json()).resolves.toEqual({ count: 2, token: 'b' });

            expect(fetchImpl).toHaveBeenCalledTimes(2);
            expect(client.state.cache?.size()).toBe(0);
        },
    );

    it('does not cache unexpected statuses or validation failures', async () => {
        const schema = {
            parse(input: unknown): { id: string } {
                if (typeof input === 'object' && input !== null && 'id' in input) {
                    return input as { id: string };
                }
                throw new Error('invalid');
            },
        };
        const fetchImpl = vi
            .fn<typeof fetch>()
            .mockResolvedValueOnce(new Response('server error', { status: 500 }))
            .mockResolvedValueOnce(new Response(JSON.stringify({ nope: true })))
            .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'usr_123' })));
        const client = avirx('https://api.example.com', { fetch: fetchImpl }).cache({ ttl: '1s' });

        const result = await client.get('/users/usr_123').result();
        await expect(client.get('/users/usr_123').as(schema)).rejects.toThrow('Response validation failed.');
        await expect(client.get('/users/usr_123').as(schema)).resolves.toEqual({ id: 'usr_123' });

        expect(result.ok).toBe(false);
        expect(fetchImpl).toHaveBeenCalledTimes(3);
    });

    it('expires entries after ttl', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(0);
        const fetchImpl = vi
            .fn<typeof fetch>()
            .mockResolvedValueOnce(new Response('first'))
            .mockResolvedValueOnce(new Response('second'));
        const client = avirx('https://api.example.com', { fetch: fetchImpl }).cache({ ttl: '100ms' });

        await expect(client.get('/feature-flags').text()).resolves.toBe('first');
        await vi.advanceTimersByTimeAsync(99);
        await expect(client.get('/feature-flags').text()).resolves.toBe('first');
        await vi.advanceTimersByTimeAsync(1);
        await expect(client.get('/feature-flags').text()).resolves.toBe('second');

        expect(fetchImpl).toHaveBeenCalledTimes(2);
    });

    it('does not consume rate-limit budget or hooks for cache hits', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(0);
        const events: string[] = [];
        const fetchImpl = vi.fn<typeof fetch>(async () => Promise.resolve(new Response('ok')));
        const client = avirx('https://api.example.com', { fetch: fetchImpl })
            .cache({ ttl: '1s' })
            .rateLimit({ per: '1s', requests: 1 })
            .on('request', () => {
                events.push('request');
            })
            .on('response', () => {
                events.push('response');
            });

        await expect(client.get('/reference-data').text()).resolves.toBe('ok');
        const second = client.get('/reference-data').text();
        await vi.advanceTimersByTimeAsync(0);

        await expect(second).resolves.toBe('ok');
        expect(fetchImpl).toHaveBeenCalledOnce();
        expect(client.state.rateLimit?.starts()).toBe(1);
        expect(events).toEqual(['request', 'response']);
    });

    it('caches contract calls through the same policy', async () => {
        const fetchImpl = vi.fn<typeof fetch>(async () =>
            Promise.resolve(new Response(JSON.stringify({ id: 'usr_123' }))),
        );
        const User = {
            parse(input: unknown): { id: string } {
                return input as { id: string };
            },
        };
        const Params = {
            parse(input: unknown): { id: string } {
                return input as { id: string };
            },
        };
        const api = avirx('https://api.example.com', { fetch: fetchImpl })
            .cache({ ttl: '1s' })
            .contract({
                getUser: endpoint.get('/users/{id}').params(Params).returns(User),
            });

        await expect(api.getUser({ path: { id: 'usr_123' } })).resolves.toEqual({ id: 'usr_123' });
        await expect(api.getUser({ path: { id: 'usr_123' } })).resolves.toEqual({ id: 'usr_123' });

        expect(fetchImpl).toHaveBeenCalledOnce();
    });
});

function fetchInputUrl(input: Parameters<typeof fetch>[0]): URL {
    if (input instanceof URL) {
        return input;
    }
    if (input instanceof Request) {
        return new URL(input.url);
    }
    if (typeof input === 'string') {
        return new URL(input);
    }

    throw new TypeError('Expected fetch input to be a URL-compatible value.');
}
