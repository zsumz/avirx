import { afterEach, describe, expect, it, vi } from 'vitest';
import { avirx } from 'avirx';

describe('rate-limit lifecycle', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it.each(['abort', 'timeout'] as const)('clears the last wake timer on %s', async (mode) => {
        vi.useFakeTimers();
        const controller = new AbortController();
        const client = avirx('https://example.com', {
            fetch: async () => Promise.resolve(new Response('ok')),
        }).rateLimit({
            per: '60s',
            ...mode === 'timeout' ? { queueTimeout: '20ms' } : {},
            requests: 1,
        });
        await client.get('/first').send();
        const pending = client.get('/queued').signal(controller.signal).result();
        await vi.advanceTimersByTimeAsync(0);
        expect(client.state.rateLimit?.queued()).toBe(1);
        if (mode === 'abort') {
            controller.abort();
        } else {
            await vi.advanceTimersByTimeAsync(20);
        }
        expect((await pending).ok).toBe(false);
        expect(client.state.rateLimit?.queued()).toBe(0);
        expect(vi.getTimerCount()).toBe(0);
    });

    it('releases a concurrency slot when rate admission is aborted', async () => {
        vi.useFakeTimers();
        const controller = new AbortController();
        const client = avirx('https://example.com', {
            fetch: async () => Promise.resolve(new Response('ok')),
        }).concurrency(1).rateLimit({ per: '60s', requests: 1 });
        await client.get('/first').send();
        const pending = client.get('/queued').signal(controller.signal).result();
        await vi.advanceTimersByTimeAsync(0);
        expect(client.state.concurrency?.active()).toBe(1);
        controller.abort();
        expect((await pending).ok).toBe(false);
        expect(client.state.concurrency?.active()).toBe(0);
        expect(vi.getTimerCount()).toBe(0);
    });

    it('preserves live waiters through repeated aborts behind the FIFO head', async () => {
        vi.useFakeTimers();
        const client = avirx('https://example.com').rateLimit({ per: '1s', requests: 1 });
        const limiter = client.state.rateLimit;
        if (!limiter) throw new Error('Expected a rate-limit policy.');
        const request = await client.get('/').build();
        await limiter.acquire(request);
        const first = limiter.acquire(request);
        for (let index = 0; index < 100; index += 1) {
            const controller = new AbortController();
            const cause = new Error('Cancelled transient waiter.');
            const transient = limiter.acquire(request, controller.signal);
            controller.abort(cause);
            await expect(transient).rejects.toMatchObject({ cause, message: 'Request aborted.' });
        }
        const second = limiter.acquire(request);
        expect(limiter.queued()).toBe(2);

        await vi.advanceTimersByTimeAsync(1000);
        await first;
        expect(limiter.queued()).toBe(1);
        expect(limiter.starts()).toBe(1);
        await vi.advanceTimersByTimeAsync(1000);
        await second;
        expect(limiter.queued()).toBe(0);
        expect(limiter.starts()).toBe(1);
        expect(vi.getTimerCount()).toBe(0);
    });
});
