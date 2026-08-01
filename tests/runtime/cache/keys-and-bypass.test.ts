import { afterEach, describe, expect, it, vi } from 'vitest';
import { avirx } from 'avirx';

describe('cache policy', () => {
    afterEach(() => {
        vi.useRealTimers();
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
