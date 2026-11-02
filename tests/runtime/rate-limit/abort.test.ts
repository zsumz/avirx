import { afterEach, describe, expect, it, vi } from 'vitest';
import { avirx } from 'avirx';

describe('rate-limit policy', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it('does not consume budget for build, preview, or curl', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(0);
        const fetchImpl = vi.fn<typeof fetch>(async () => Promise.resolve(new Response('ok')));
        const client = avirx('https://api.example.com', { fetch: fetchImpl }).rateLimit({
            per: '100ms',
            requests: 1,
        });

        await client.get('/inspect').build();
        await client.get('/inspect').preview();
        await client.get('/inspect').curl();

        const first = client.get('/first').send();
        const second = client.get('/second').send();
        await vi.advanceTimersByTimeAsync(0);

        expect(fetchImpl).toHaveBeenCalledOnce();
        await vi.advanceTimersByTimeAsync(100);
        expect(fetchImpl).toHaveBeenCalledTimes(2);
        await Promise.all([first, second]);
    });

    it('returns result-mode errors when the queue is full', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(0);
        const fetchImpl = vi.fn<typeof fetch>(async () => Promise.resolve(new Response('ok')));
        const client = avirx('https://api.example.com', { fetch: fetchImpl }).rateLimit({
            per: '1s',
            queue: 0,
            requests: 1,
        });

        const first = client.get('/first').send();
        await vi.advanceTimersByTimeAsync(0);

        const result = await client.get('/second').result();

        expect(result.ok).toBe(false);
        if (result.ok) {
            throw new Error('Expected rate-limit error result.');
        }
        expect(result.status).toBeUndefined();
        expect(result.response).toBeUndefined();
        expect(result.error.message).toBe('Rate limit queue is full.');
        expect(result.error.kind).toBe('queue-full');
        expect(result.error.request.url.href).toBe('https://api.example.com/second');
        expect(fetchImpl).toHaveBeenCalledOnce();
        await first;
    });

    it('times out queued requests distinctly from fetch timeouts', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(0);
        const fetchImpl = vi.fn<typeof fetch>(async () => Promise.resolve(new Response('ok')));
        const client = avirx('https://api.example.com', { fetch: fetchImpl }).rateLimit({
            per: '1s',
            queueTimeout: '50ms',
            requests: 1,
        });

        const first = client.get('/first').send();
        const second = client.get('/second').result();

        await vi.advanceTimersByTimeAsync(0);
        expect(fetchImpl).toHaveBeenCalledOnce();

        await vi.advanceTimersByTimeAsync(50);
        const result = await second;

        expect(result.ok).toBe(false);
        if (result.ok) {
            throw new Error('Expected rate-limit timeout result.');
        }
        expect(result.error.message).toBe('Rate limit queue timed out.');
        expect(result.error.kind).toBe('queue-timeout');
        expect(result.status).toBeUndefined();
        expect(result.response).toBeUndefined();
        expect(client.state.rateLimit?.queued()).toBe(0);
        await first;
    });
});
