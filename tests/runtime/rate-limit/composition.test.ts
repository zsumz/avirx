import { afterEach, describe, expect, it, vi } from 'vitest';
import { avirx, endpoint } from 'avirx';

describe('rate-limit policy', () => {
    afterEach(() => {
        vi.useRealTimers();
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
