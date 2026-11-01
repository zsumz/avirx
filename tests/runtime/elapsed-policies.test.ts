import { afterEach, describe, expect, it, vi } from 'vitest';
import { avirx } from 'avirx';
import { publicResponse } from '../helpers/public-response.js';

describe('elapsed policy clocks', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it.each([60_000, -60_000])('keeps a rate window across a %i ms wall-clock jump', async (jump) => {
        vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout', 'performance'] });
        vi.setSystemTime(100_000);
        const fetchImpl = vi.fn<typeof fetch>(async () => Promise.resolve(new Response('ok')));
        const client = avirx('https://example.com', { fetch: fetchImpl })
            .rateLimit({ requests: 1, per: '1s' });
        await client.get('/first').send();
        vi.setSystemTime(Date.now() + jump);
        const pending = client.get('/second').send();
        await vi.advanceTimersByTimeAsync(999);
        expect(fetchImpl).toHaveBeenCalledOnce();
        await vi.advanceTimersByTimeAsync(1);
        expect(fetchImpl).toHaveBeenCalledTimes(2);
        await pending;
        expect(client.state.rateLimit?.queued()).toBe(0);
    });

    it.each([60_000, -60_000])('keeps cache TTL across a %i ms wall-clock jump', async (jump) => {
        vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout', 'performance'] });
        vi.setSystemTime(100_000);
        let calls = 0;
        const client = avirx('https://example.com', {
            fetch: async () => Promise.resolve(publicResponse(String(++calls))),
        }).cache({ ttl: '1s' });
        await expect(client.get('/reference').text()).resolves.toBe('1');
        vi.setSystemTime(Date.now() + jump);
        await vi.advanceTimersByTimeAsync(999);
        const cached = await client.get('/reference').send();
        await expect(cached.native.text()).resolves.toBe('1');
        expect(cached.timing).toMatchObject({ durationMs: 0, endedAt: Date.now(), startedAt: Date.now() });
        await vi.advanceTimersByTimeAsync(1);
        await expect(client.get('/reference').text()).resolves.toBe('2');
        expect(calls).toBe(2);
    });
});
