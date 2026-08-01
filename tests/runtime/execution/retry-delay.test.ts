import { afterEach, describe, expect, it, vi } from 'vitest';
import { avirx } from 'avirx';

describe('fetch execution', () => {
    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('honors Retry-After delta seconds for retryable 429 responses', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(0);
        const fetchImpl = vi
            .fn<typeof fetch>()
            .mockResolvedValueOnce(new Response('busy', {
                headers: { 'retry-after': '1' },
                status: 429,
            }))
            .mockResolvedValueOnce(new Response('ok'));

        const request = avirx('https://api.example.com', { fetch: fetchImpl })
            .get('/users')
            .retry({ attempts: 1, on: [429] })
            .send();

        await vi.advanceTimersByTimeAsync(0);
        expect(fetchImpl).toHaveBeenCalledOnce();

        await vi.advanceTimersByTimeAsync(999);
        expect(fetchImpl).toHaveBeenCalledOnce();

        await vi.advanceTimersByTimeAsync(1);
        const response = await request;

        expect(fetchImpl).toHaveBeenCalledTimes(2);
        expect(response.status).toBe(200);
        expect(response.timing.retryEvents).toEqual([
            {
                attempt: 1,
                delayMs: 1000,
                status: 429,
            },
        ]);
    });

    it('honors Retry-After HTTP dates for retryable 503 responses', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(Date.parse('Wed, 21 Oct 2015 07:28:00 GMT'));
        const fetchImpl = vi
            .fn<typeof fetch>()
            .mockResolvedValueOnce(new Response('busy', {
                headers: { 'retry-after': 'Wed, 21 Oct 2015 07:28:02 GMT' },
                status: 503,
            }))
            .mockResolvedValueOnce(new Response('ok'));

        const responsePromise = avirx('https://api.example.com', { fetch: fetchImpl })
            .get('/users')
            .retry({ attempts: 1, on: [503] })
            .send();

        await vi.advanceTimersByTimeAsync(1999);
        expect(fetchImpl).toHaveBeenCalledOnce();

        await vi.advanceTimersByTimeAsync(1);
        const response = await responsePromise;

        expect(fetchImpl).toHaveBeenCalledTimes(2);
        expect(response.timing.retryEvents).toEqual([
            {
                attempt: 1,
                delayMs: 2000,
                status: 503,
            },
        ]);
    });

    it('aborts during retry delay without starting the next fetch attempt', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(0);
        const controller = new AbortController();
        const fetchImpl = vi.fn<typeof fetch>(async () => Promise.resolve(new Response('busy', { status: 503 })));
        const request = avirx('https://api.example.com', { fetch: fetchImpl })
            .signal(controller.signal)
            .get('/users')
            .retry({ attempts: 1, on: [503] })
            .result();

        await vi.advanceTimersByTimeAsync(0);
        expect(fetchImpl).toHaveBeenCalledOnce();

        controller.abort('cancelled');
        await vi.advanceTimersByTimeAsync(10);
        const result = await request;

        expect(result.ok).toBe(false);
        if (result.ok) {
            throw new Error('Expected aborted retry result.');
        }
        expect(result.error.message).toBe('Request aborted.');
        expect(fetchImpl).toHaveBeenCalledOnce();
        vi.useRealTimers();
    });
});
