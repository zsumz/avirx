import { afterEach, describe, expect, it, vi } from 'vitest';
import { avirx } from 'avirx';

describe('rate-limit dispatch', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it('cannot accumulate rate reservations behind asynchronous request hooks', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(0);
        let finishHook!: () => void;
        const hook: Promise<void> = new Promise((resolve) => {
            finishHook = resolve;
        });
        const starts: number[] = [];
        const client = avirx('https://example.com', {
            fetch: async () => {
                starts.push(Date.now());
                return Promise.resolve(new Response('ok'));
            },
        }).rateLimit({ per: '100ms', requests: 1 });
        const slowHook = client.get('/hook').on('request', async () => hook).send();
        const immediate = client.get('/immediate').send();
        await vi.advanceTimersByTimeAsync(500);
        expect(starts).toEqual([0]);
        const third = client.get('/third').send();
        finishHook();
        await vi.advanceTimersByTimeAsync(0);
        expect(starts).toEqual([0, 500]);
        await vi.advanceTimersByTimeAsync(100);
        await Promise.all([slowHook, immediate, third]);
        expect(starts).toEqual([0, 500, 600]);
    });
});
