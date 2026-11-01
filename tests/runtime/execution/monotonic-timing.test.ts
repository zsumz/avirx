import { afterEach, describe, expect, it, vi } from 'vitest';
import { avirx } from 'avirx';
import { calculateRetryDelayMs } from '../../../src/policy/retry/retry.js';

describe('response timing clocks', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it.each([60_000, -60_000])('measures duration across a %i ms wall-clock jump', async (jump) => {
        vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout', 'performance'] });
        vi.setSystemTime(100_000);
        const client = avirx('https://example.com', {
            fetch: async () => {
                await new Promise((resolve) => setTimeout(resolve, 25));
                vi.setSystemTime(Date.now() + jump);
                return new Response('ok');
            },
        });
        const pending = client.get('/slow').send();
        await vi.advanceTimersByTimeAsync(25);
        const response = await pending;
        expect(response.timing).toMatchObject({
            durationMs: 25,
            startedAt: 100_000,
            endedAt: 100_025 + jump,
        });
    });

    it('uses the wall clock for an absolute Retry-After HTTP date', () => {
        vi.useFakeTimers({ toFake: ['Date', 'performance'] });
        vi.setSystemTime(Date.parse('Wed, 21 Oct 2015 07:28:00 GMT'));
        expect(calculateRetryDelayMs(1, 'Wed, 21 Oct 2015 07:28:02 GMT')).toBe(2000);
    });
});
