import { describe, expect, it, vi } from 'vitest';
import { avirx } from 'avirx';
import { publicResponse } from '../../helpers/public-response.js';

const baseUrl = 'https://api.example.com';

describe('cache public-data boundary', () => {
    it.each([
        {},
        { 'cache-control': 'private, no-store' },
        { 'cache-control': 'extension="x, public, y"' },
        { 'cache-control': 'public="yes"' },
        { 'cache-control': 'public, extension="unterminated' },
        { 'cache-control': 'public, no-store' },
        { 'cache-control': 'public, no-cache="set-cookie"' },
        { 'cache-control': 'public, private' },
        { 'cache-control': 'public', 'set-cookie': 'session=alice' },
        { 'cache-control': 'public', vary: '*' },
        { 'cache-control': 'public', vary: 'cookie' },
        { 'cache-control': 'public', vary: 'accept-language' },
        { 'cache-control': 'public', 'content-range': 'bytes 0-4/10' },
    ])('does not reuse private or insufficiently keyed responses: %j', async (headers) => {
        let session = 'alice';
        const fetchImpl = vi.fn<typeof fetch>(async () => Promise.resolve(new Response(session, { headers })));
        const client = avirx(baseUrl, { fetch: fetchImpl }).cache({ ttl: '1s' });
        expect(await client.get('/me').text()).toBe('alice');
        session = 'bob';
        expect(await client.get('/me').text()).toBe('bob');
        expect(fetchImpl).toHaveBeenCalledTimes(2);
        expect(client.state.cache?.size()).toBe(0);
    });

    it('does not reuse partial responses', async () => {
        const fetchImpl = vi.fn<typeof fetch>(async () => Promise.resolve(publicResponse('partial', { status: 206 })));
        const client = avirx(baseUrl, { fetch: fetchImpl }).cache({ ttl: '1s' });
        await client.get('/file').text();
        await client.get('/file').text();
        expect(fetchImpl).toHaveBeenCalledTimes(2);
    });

    it.each([undefined, 'accept'])(
        'does not reuse CORS responses with visible Vary %s', async (vary) => {
            let version = 'first';
            const fetchImpl = vi.fn<typeof fetch>(async () => {
                const response = publicResponse(version, vary === undefined ? {} : { headers: { vary } });
                Object.defineProperty(response, 'type', { value: 'cors' });
                return Promise.resolve(response);
            });
            const client = avirx(baseUrl, { fetch: fetchImpl }).cache({ ttl: '1s' });
            expect(await client.get('/catalog').text()).toBe('first');
            version = 'second';
            expect(await client.get('/catalog').text()).toBe('second');
            expect(fetchImpl).toHaveBeenCalledTimes(2);
            expect(client.state.cache?.size()).toBe(0);
        },
    );

    it.each(['basic', 'default'] as const)('caches unfiltered native response type %s', async (type) => {
        const fetchImpl = vi.fn<typeof fetch>(async () => {
            const response = publicResponse('ok');
            Object.defineProperty(response, 'type', { value: type });
            return Promise.resolve(response);
        });
        const client = avirx(baseUrl, { fetch: fetchImpl }).cache({ ttl: '1s' });
        await client.get('/catalog').text();
        await client.get('/catalog').text();
        expect(fetchImpl).toHaveBeenCalledOnce();
    });

    it('rejects Vary:* even if the configured vary list contains a wildcard', async () => {
        const fetchImpl = vi.fn<typeof fetch>(async () => Promise.resolve(publicResponse('ok', {
            headers: { vary: '*' },
        })));
        const client = avirx(baseUrl, { fetch: fetchImpl }).cache({ ttl: '1s', vary: ['*'] });
        await client.get('/catalog').text();
        await client.get('/catalog').text();
        expect(fetchImpl).toHaveBeenCalledTimes(2);
    });

    it.each(['public, max-age="60"', 'public, extension="quoted\\"value, test"'])(
        'accepts quoted directive values without confusing separators: %s', async (directive) => {
            const fetchImpl = vi.fn<typeof fetch>(async () => Promise.resolve(publicResponse('ok', {
                headers: { 'cache-control': directive },
            })));
            const client = avirx(baseUrl, { fetch: fetchImpl }).cache({ ttl: '1s' });
            await client.get('/catalog').text();
            await client.get('/catalog').text();
            expect(fetchImpl).toHaveBeenCalledOnce();
        },
    );

    it.each(['no-store', 'no-cache'])('bypasses reads and writes for request %s', async (directive) => {
        const fetchImpl = vi.fn<typeof fetch>(async () => Promise.resolve(publicResponse('ok')));
        const client = avirx(baseUrl, { fetch: fetchImpl }).cache({ ttl: '1s' });
        await client.get('/catalog').text();
        await client.get('/catalog').header('cache-control', directive).text();
        await client.get('/catalog').header('cache-control', directive).text();
        expect(fetchImpl).toHaveBeenCalledTimes(3);
    });

    it('accepts server vary fields only when included in the cache key', async () => {
        const fetchImpl = vi.fn<typeof fetch>(async () => Promise.resolve(publicResponse('bonjour', {
            headers: { vary: 'Accept-Language' },
        })));
        const client = avirx(baseUrl, { fetch: fetchImpl }).cache({
            ttl: '1s', vary: ['accept-language'],
        });
        await client.get('/catalog').header('accept-language', 'fr').text();
        await client.get('/catalog').header('accept-language', 'fr').text();
        expect(fetchImpl).toHaveBeenCalledOnce();
    });

    it('preserves null bodies for cached HEAD responses', async () => {
        const fetchImpl = vi.fn<typeof fetch>(async () => Promise.resolve(publicResponse(null)));
        const client = avirx(baseUrl, { fetch: fetchImpl }).cache({ methods: ['HEAD'], ttl: '1s' });
        await client.head('/catalog').text();
        expect((await client.head('/catalog').send()).native.body).toBeNull();
        expect(fetchImpl).toHaveBeenCalledOnce();
    });

    it('retains final response URL across cache hits', async () => {
        const fetchImpl = vi.fn<typeof fetch>(async () => {
            const response = publicResponse('ok');
            Object.defineProperty(response, 'url', { value: `${baseUrl}/final` });
            return Promise.resolve(response);
        });
        const client = avirx(baseUrl, { fetch: fetchImpl }).cache({ ttl: '1s' });
        await client.get('/redirect').text();
        expect((await client.get('/redirect').send()).url).toBe(`${baseUrl}/final`);
        expect(fetchImpl).toHaveBeenCalledOnce();
    });

    it('leaves send streams readable immediately without populating cache', async () => {
        let controller!: ReadableStreamDefaultController<Uint8Array>;
        const stream: ReadableStream<Uint8Array> = new ReadableStream({ start(value) {
            controller = value;
        } });
        const fetchImpl = vi.fn<typeof fetch>(async () => Promise.resolve(publicResponse(stream)));
        const client = avirx(baseUrl, { fetch: fetchImpl }).cache({ ttl: '1s' });
        const response = await client.get('/events').send();
        controller.enqueue(new TextEncoder().encode('event'));
        const reader = response.native.body?.getReader();
        expect((await reader?.read())?.value).toEqual(new TextEncoder().encode('event'));
        controller.close();
        reader?.releaseLock();
        expect(client.state.cache?.size()).toBe(0);
    });
});
