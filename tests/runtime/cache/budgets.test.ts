import { afterEach, describe, expect, it, vi } from 'vitest';
import { avirx } from 'avirx';
import { publicResponse } from '../../helpers/public-response.js';

const baseUrl = 'https://api.example.com';

describe('bounded cache storage', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it('evicts least recently used entries within the entry budget', async () => {
        const fetchImpl = vi.fn<typeof fetch>(async () => Promise.resolve(publicResponse('ok')));
        const client = avirx(baseUrl, { fetch: fetchImpl }).cache({ maxEntries: 2, ttl: '1s' });
        for (const path of ['/a', '/b', '/a', '/c', '/a', '/b']) await client.get(path).text();
        expect(fetchImpl).toHaveBeenCalledTimes(4);
        expect(client.state.cache?.size()).toBe(2);
    });

    it('evicts entries within the total-byte budget', async () => {
        const fetchImpl = vi.fn<typeof fetch>(async () => Promise.resolve(publicResponse('data')));
        const client = avirx(baseUrl, { fetch: fetchImpl }).cache({ maxTotalBytes: 6, ttl: '1s' });
        for (const path of ['/a', '/b', '/b', '/a']) await client.get(path).text();
        expect(fetchImpl).toHaveBeenCalledTimes(3);
        expect(client.state.cache?.size()).toBe(1);
    });

    it('does not store responses exceeding the total budget', async () => {
        const fetchImpl = vi.fn<typeof fetch>(async () => Promise.resolve(publicResponse('large')));
        const client = avirx(baseUrl, { fetch: fetchImpl }).cache({ maxTotalBytes: 2, ttl: '1s' });
        await client.get('/a').text();
        await client.get('/a').text();
        expect(fetchImpl).toHaveBeenCalledTimes(2);
        expect(client.state.cache?.size()).toBe(0);
    });

    it('reclaims expired entries before evicting live entries', async () => {
        vi.useFakeTimers();
        const fetchImpl = vi.fn<typeof fetch>(async () => Promise.resolve(publicResponse('ok')));
        const client = avirx(baseUrl, { fetch: fetchImpl }).cache({ maxEntries: 2, ttl: 15 });
        await client.get('/old').text();
        await vi.advanceTimersByTimeAsync(10);
        await client.get('/live').text();
        await vi.advanceTimersByTimeAsync(4);
        await client.get('/old').text();
        await vi.advanceTimersByTimeAsync(2);
        await client.get('/new').text();
        await client.get('/live').text();
        expect(fetchImpl).toHaveBeenCalledTimes(3);
        expect(client.state.cache?.size()).toBe(2);
    });

    it('clears shared storage so the next request refetches', async () => {
        const fetchImpl = vi.fn<typeof fetch>(async () => Promise.resolve(publicResponse('ok')));
        const client = avirx(baseUrl, { fetch: fetchImpl }).cache({ ttl: '1s' });
        const clone = client.header('x-client', 'clone');
        await client.get('/a').text();
        clone.state.cache?.clear();
        await client.get('/a').text();
        expect(fetchImpl).toHaveBeenCalledTimes(2);
    });

    it.each([
        { maxEntries: 0 }, { maxEntries: 1.5 }, { maxEntries: Infinity },
        { maxTotalBytes: -1 }, { maxTotalBytes: 1.5 }, { maxTotalBytes: Infinity },
    ])('rejects invalid budgets: %j', (options) => {
        expect(() => avirx(baseUrl).cache({ ...options, ttl: '1s' })).toThrow(TypeError);
    });
});
