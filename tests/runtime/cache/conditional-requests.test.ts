import { describe, expect, it, vi } from 'vitest';
import { avirx } from 'avirx';
import { publicResponse } from '../../helpers/public-response.js';

const headers = [
    ['range', 'bytes=0-9'],
    ['if-range', '"version-1"'],
    ['if-match', '"version-1"'],
    ['if-none-match', '"version-1"'],
    ['if-modified-since', 'Wed, 21 Oct 2015 07:28:00 GMT'],
    ['if-unmodified-since', 'Wed, 21 Oct 2015 07:28:00 GMT'],
] as const;
const cases = headers.flatMap(([name, value]) => [{ name, value }, { name, value: '' }]);

describe('conditional and range cache boundary', () => {
    it.each(cases)('bypasses a warm cache for $name: "$value"', async ({ name, value }) => {
        let calls = 0;
        const fetchImpl = vi.fn<typeof fetch>(async () => {
            calls += 1;
            return Promise.resolve(publicResponse(`network-${String(calls)}`));
        });
        const client = avirx('https://example.com', { fetch: fetchImpl }).cache({ ttl: '1s' });

        expect(await client.get('/catalog').text()).toBe('network-1');
        expect(await client.get('/catalog').header(name, value).text()).toBe('network-2');
        expect(await client.get('/catalog').text()).toBe('network-1');
        expect(await client.get('/catalog').header(name, value).text()).toBe('network-3');
        expect(fetchImpl).toHaveBeenCalledTimes(3);
        expect(client.state.cache?.size()).toBe(1);
    });

    it.each(cases)('does not populate an ordinary cache from $name: "$value"', async ({ name, value }) => {
        let calls = 0;
        const fetchImpl = vi.fn<typeof fetch>(async () => {
            calls += 1;
            return Promise.resolve(publicResponse(`network-${String(calls)}`));
        });
        const client = avirx('https://example.com', { fetch: fetchImpl }).cache({ ttl: '1s' });

        expect(await client.get('/catalog').header(name, value).text()).toBe('network-1');
        expect(client.state.cache?.size()).toBe(0);
        expect(await client.get('/catalog').text()).toBe('network-2');
        expect(await client.get('/catalog').text()).toBe('network-2');
        expect(await client.get('/catalog').header(name, value).text()).toBe('network-3');
        expect(fetchImpl).toHaveBeenCalledTimes(3);
        expect(client.state.cache?.size()).toBe(1);
    });
});
