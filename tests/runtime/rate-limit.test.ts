import { afterEach, describe, expect, it, vi } from 'vitest';

import { avirx, endpoint } from 'avirx';

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
        expect(result.status).toBeUndefined();
        expect(result.response).toBeUndefined();
        expect(client.state.rateLimit?.queued()).toBe(0);
        await first;
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

    it('waits for rate-limit budget before acquiring concurrency slots', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(0);
        const first = createDeferred<Response>();
        const fetchImpl = vi
            .fn<typeof fetch>()
            .mockReturnValueOnce(first.promise)
            .mockResolvedValueOnce(new Response('ok'));
        const client = avirx('https://api.example.com', { fetch: fetchImpl })
            .rateLimit({ per: '100ms', requests: 1 })
            .concurrency(1);

        const firstRequest = client.get('/first').send();
        const secondRequest = client.get('/second').send();

        await vi.advanceTimersByTimeAsync(0);
        expect(fetchImpl).toHaveBeenCalledOnce();
        expect(client.state.rateLimit?.queued()).toBe(1);
        expect(client.state.concurrency?.queued()).toBe(0);

        await vi.advanceTimersByTimeAsync(100);
        expect(client.state.concurrency?.queued()).toBe(1);
        expect(fetchImpl).toHaveBeenCalledOnce();

        first.resolve(new Response('ok'));
        await firstRequest;
        await vi.advanceTimersByTimeAsync(0);

        expect(fetchImpl).toHaveBeenCalledTimes(2);
        await secondRequest;
    });

    it('limits contract calls through the same client policy', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(0);
        const fetchImpl = vi.fn<typeof fetch>(async () =>
            Promise.resolve(new Response(JSON.stringify({ id: 'usr_123' }))),
        );
        const User = {
            parse(input: unknown): { id: string } {
                return input as { id: string };
            },
        };
        const Params = {
            parse(input: unknown): { id: string } {
                return input as { id: string };
            },
        };
        const api = avirx('https://api.example.com', { fetch: fetchImpl })
            .rateLimit({ per: '100ms', requests: 1 })
            .contract({
                getUser: endpoint.get('/users/{id}').params(Params).returns(User),
            });

        const first = api.getUser({ path: { id: 'usr_123' } });
        const second = api.getUser({ path: { id: 'usr_456' } });

        await vi.advanceTimersByTimeAsync(0);
        expect(fetchImpl).toHaveBeenCalledOnce();

        await vi.advanceTimersByTimeAsync(100);
        expect(fetchImpl).toHaveBeenCalledTimes(2);
        await Promise.all([first, second]);
    });
});

interface Deferred<T> {
    promise: Promise<T>;
    resolve(value: T): void;
}

function createDeferred<T>(): Deferred<T> {
    let resolve!: (value: T) => void;
    const promise: Promise<T> = new Promise((innerResolve) => {
        resolve = innerResolve;
    });

    return { promise, resolve };
}

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
