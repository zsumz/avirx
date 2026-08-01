import { describe, expect, it, vi } from 'vitest';
import { avirx, endpoint } from 'avirx';

describe('concurrency policy', () => {
    it('removes aborted requests from the concurrency queue', async () => {
        const first = createDeferred<Response>();
        const controller = new AbortController();
        const fetchImpl = vi
            .fn<typeof fetch>()
            .mockReturnValueOnce(first.promise)
            .mockResolvedValueOnce(new Response('ok'));
        const client = avirx('https://api.example.com', { fetch: fetchImpl }).concurrency(1);

        const firstRequest = client.get('/first').send();
        await waitFor(() => fetchImpl.mock.calls.length === 1);

        const secondRequest = client.get('/second').signal(controller.signal).result();
        await waitFor(() => client.state.concurrency?.queued() === 1);

        controller.abort('cancelled');
        const result = await secondRequest;

        expect(result.ok).toBe(false);
        if (result.ok) {
            throw new Error('Expected aborted concurrency result.');
        }
        expect(result.error.message).toBe('Request aborted.');
        expect(client.state.concurrency?.queued()).toBe(0);

        first.resolve(new Response('ok'));
        await firstRequest;
        expect(fetchImpl).toHaveBeenCalledOnce();
        expect(client.state.concurrency?.active()).toBe(0);
    });

    it('does not hold slots during retry delays', async () => {
        const order: string[] = [];
        let retryAttempts = 0;
        const fetchImpl = vi.fn<typeof fetch>(async (input) => {
            const url = fetchInputUrl(input);
            order.push(url.pathname);

            if (url.pathname === '/retry' && retryAttempts === 0) {
                retryAttempts += 1;
                return Promise.resolve(new Response('busy', { status: 503 }));
            }

            return Promise.resolve(new Response('ok'));
        });
        const client = avirx('https://api.example.com', { fetch: fetchImpl }).concurrency(1);

        const retrying = client.get('/retry').retry({ attempts: 1, on: [503] }).send();
        await waitFor(() => order.length === 1);

        const other = client.get('/other').send();
        await other;
        await retrying;

        expect(order).toEqual(['/retry', '/other', '/retry']);
        expect(client.state.concurrency?.active()).toBe(0);
        expect(client.state.concurrency?.queued()).toBe(0);
    });

    it('limits contract calls through the same client policy', async () => {
        const first = createDeferred<Response>();
        const fetchImpl = vi
            .fn<typeof fetch>()
            .mockReturnValueOnce(first.promise)
            .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'usr_456' })));
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
        const api = avirx('https://api.example.com', { fetch: fetchImpl }).concurrency(1).contract({
            getUser: endpoint.get('/users/{id}').params(Params).returns(User),
        });

        const firstCall = api.getUser({ path: { id: 'usr_123' } });
        await waitFor(() => fetchImpl.mock.calls.length === 1);

        const secondCall = api.getUser({ path: { id: 'usr_456' } });
        await delay();
        expect(fetchImpl).toHaveBeenCalledOnce();

        first.resolve(new Response(JSON.stringify({ id: 'usr_123' })));
        await expect(firstCall).resolves.toEqual({ id: 'usr_123' });
        await expect(secondCall).resolves.toEqual({ id: 'usr_456' });
        expect(fetchImpl).toHaveBeenCalledTimes(2);
    });
});

interface Deferred<T> {
    promise: Promise<T>;
    resolve(value: T): void;
    reject(error: unknown): void;
}

function createDeferred<T>(): Deferred<T> {
    let resolve!: (value: T) => void;
    let reject!: (error: unknown) => void;
    const promise: Promise<T> = new Promise((innerResolve, innerReject) => {
        resolve = innerResolve;
        reject = innerReject;
    });

    return { promise, reject, resolve };
}

async function waitFor(condition: () => boolean): Promise<void> {
    for (let attempt = 0; attempt < 50; attempt += 1) {
        if (condition()) {
            return;
        }

        await delay();
    }

    throw new Error('Timed out waiting for condition.');
}

async function delay(): Promise<void> {
    await new Promise((resolve) => {
        setTimeout(resolve, 0);
    });
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
