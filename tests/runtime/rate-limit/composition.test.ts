import { afterEach, describe, expect, it, vi } from 'vitest';
import { avirx, endpoint } from 'avirx';

describe('rate-limit policy', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it('spaces actual dispatches after a slow concurrency occupant', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(0);
        const first = createDeferred<Response>();
        const starts: number[] = [];
        const fetchImpl = vi.fn<typeof fetch>(async () => {
            starts.push(Date.now());
            return starts.length === 1 ? first.promise : Promise.resolve(new Response('ok'));
        });
        const client = avirx('https://api.example.com', { fetch: fetchImpl })
            .rateLimit({ per: '100ms', requests: 1 })
            .concurrency(1);

        const requests = ['/first', '/second', '/third'].map(async (route) => client.get(route).send());
        await vi.advanceTimersByTimeAsync(500);
        expect(starts).toEqual([0]);
        expect(client.state.concurrency?.queued()).toBe(2);
        expect(client.state.rateLimit?.queued()).toBe(0);

        first.resolve(new Response('ok'));
        await vi.advanceTimersByTimeAsync(0);
        expect(starts).toEqual([0, 500]);
        await vi.advanceTimersByTimeAsync(99);
        expect(starts).toHaveLength(2);
        await vi.advanceTimersByTimeAsync(1);
        await Promise.all(requests);
        expect(starts).toEqual([0, 500, 600]);
        expect(client.state.concurrency?.active()).toBe(0);
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
