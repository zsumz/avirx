import { describe, expect, it } from 'vitest';
import { avirx } from 'avirx';

describe('concurrency cancellation churn', () => {
    it('removes aborted waiters behind a live waiter and grants remaining slots in FIFO order', async () => {
        const limiter = avirx('https://example.com').concurrency(1).state.concurrency;
        if (!limiter) throw new Error('Expected a concurrency policy.');
        const releaseInitial = await limiter.acquire();
        const first = limiter.acquire();
        for (let index = 0; index < 100; index += 1) {
            const controller = new AbortController();
            const cause = new Error('Cancelled transient waiter.');
            const transient = limiter.acquire(controller.signal);
            controller.abort(cause);
            await expect(transient).rejects.toBe(cause);
        }
        const second = limiter.acquire();
        expect(limiter.queued()).toBe(2);
        expect(limiter.active()).toBe(1);

        releaseInitial();
        const releaseFirst = await first;
        expect(limiter.queued()).toBe(1);
        expect(limiter.active()).toBe(1);
        releaseFirst();
        const releaseSecond = await second;
        expect(limiter.queued()).toBe(0);
        expect(limiter.active()).toBe(1);
        releaseSecond();
        expect(limiter.active()).toBe(0);
    });
});
