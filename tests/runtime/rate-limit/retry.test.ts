import { afterEach, describe, expect, it, vi } from 'vitest';
import { avirx } from 'avirx';

describe('rate-limit policy', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it('removes aborted requests from the rate-limit queue', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(0);
        const controller = new AbortController();
        const fetchImpl = vi.fn<typeof fetch>(async () => Promise.resolve(new Response('ok')));
        const client = avirx('https://api.example.com', { fetch: fetchImpl }).rateLimit({
            per: '1s',
            requests: 1,
        });

        const first = client.get('/first').send();
        const second = client.get('/second').signal(controller.signal).result();

        await vi.advanceTimersByTimeAsync(0);
        expect(fetchImpl).toHaveBeenCalledOnce();
        expect(client.state.rateLimit?.queued()).toBe(1);

        controller.abort('cancelled');
        const result = await second;

        expect(result.ok).toBe(false);
        if (result.ok) {
            throw new Error('Expected aborted rate-limit result.');
        }
        expect(result.error.message).toBe('Request aborted.');
        expect(result.status).toBeUndefined();
        expect(result.response).toBeUndefined();
        expect(client.state.rateLimit?.queued()).toBe(0);
        await first;
    });

    it('consumes budget for each retry attempt', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(0);
        const starts: number[] = [];
        const fetchImpl = vi
            .fn<typeof fetch>(async () => {
                starts.push(Date.now());
                return Promise.resolve(new Response('busy', { status: 503 }));
            })
            .mockImplementationOnce(async () => {
                starts.push(Date.now());
                return Promise.resolve(new Response('busy', { status: 503 }));
            })
            .mockImplementationOnce(async () => {
                starts.push(Date.now());
                return Promise.resolve(new Response('ok'));
            });
        const request = avirx('https://api.example.com', { fetch: fetchImpl })
            .rateLimit({ per: '100ms', requests: 1 })
            .get('/retry')
            .retry({ attempts: 1, on: [503] })
            .send();

        await vi.advanceTimersByTimeAsync(0);
        expect(fetchImpl).toHaveBeenCalledOnce();

        await vi.advanceTimersByTimeAsync(10);
        expect(fetchImpl).toHaveBeenCalledOnce();

        await vi.advanceTimersByTimeAsync(90);
        expect(fetchImpl).toHaveBeenCalledTimes(2);
        await request;

        expect(starts).toEqual([0, 100]);
    });
});
