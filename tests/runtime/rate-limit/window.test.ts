import { afterEach, describe, expect, it, vi } from 'vitest';
import { avirx } from 'avirx';

describe('rate-limit policy', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it('limits request starts per window', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(0);
        const starts: number[] = [];
        const fetchImpl = vi.fn<typeof fetch>(async () => {
            starts.push(Date.now());
            return Promise.resolve(new Response('ok'));
        });
        const client = avirx('https://api.example.com', { fetch: fetchImpl }).rateLimit({
            per: '100ms',
            requests: 2,
        });

        const first = client.get('/first').send();
        const second = client.get('/second').send();
        const third = client.get('/third').send();

        await vi.advanceTimersByTimeAsync(0);
        expect(fetchImpl).toHaveBeenCalledTimes(2);
        expect(client.state.rateLimit?.queued()).toBe(1);

        await vi.advanceTimersByTimeAsync(99);
        expect(fetchImpl).toHaveBeenCalledTimes(2);

        await vi.advanceTimersByTimeAsync(1);
        expect(fetchImpl).toHaveBeenCalledTimes(3);
        await Promise.all([first, second, third]);

        expect(starts).toEqual([0, 0, 100]);
        expect(client.state.rateLimit?.queued()).toBe(0);
    });

    it('queues FIFO across cloned clients', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(0);
        const order: string[] = [];
        const fetchImpl = vi.fn<typeof fetch>(async (input) => {
            order.push(fetchInputUrl(input).pathname);
            return Promise.resolve(new Response('ok'));
        });
        const base = avirx('https://api.example.com', { fetch: fetchImpl }).rateLimit({
            per: '100ms',
            requests: 1,
        });
        const clone = base.header('x-client', 'clone');

        const first = base.get('/first').send();
        const second = clone.get('/second').send();
        const third = base.get('/third').send();

        await vi.advanceTimersByTimeAsync(0);
        expect(order).toEqual(['/first']);
        expect(base.state.rateLimit).toBe(clone.state.rateLimit);

        await vi.advanceTimersByTimeAsync(100);
        expect(order).toEqual(['/first', '/second']);

        await vi.advanceTimersByTimeAsync(100);
        expect(order).toEqual(['/first', '/second', '/third']);
        await Promise.all([first, second, third]);
    });

    it('drains large FIFO queues without losing order', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(0);
        const order: string[] = [];
        const fetchImpl = vi.fn<typeof fetch>(async (input) => {
            order.push(fetchInputUrl(input).pathname);
            return Promise.resolve(new Response('ok'));
        });
        const client = avirx('https://api.example.com', { fetch: fetchImpl }).rateLimit({
            per: '1ms',
            requests: 1,
        });
        const count = 100;
        const requests = Array.from({ length: count }, async (_value, index) =>
            client.get(`/queued-${String(index)}`).send(),
        );

        await vi.advanceTimersByTimeAsync(0);
        for (let index = 1; index < count; index += 1) {
            await vi.advanceTimersByTimeAsync(1);
        }
        await Promise.all(requests);

        expect(order).toEqual(
            Array.from({ length: count }, (_value, index) => `/queued-${String(index)}`),
        );
        expect(client.state.rateLimit?.queued()).toBe(0);
        expect(client.state.rateLimit?.starts()).toBe(1);
    });
});

function fetchInputUrl(input: Parameters<typeof fetch>[0]): URL {
    if (input instanceof URL) {
        return input;
    }
    if (input instanceof Request) {
        return new URL(input.url);
    }
    if (typeof input === 'string') {
        return new URL(input);
    }

    throw new TypeError('Expected fetch input to be a URL-compatible value.');
}
