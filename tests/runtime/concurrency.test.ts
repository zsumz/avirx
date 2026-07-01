import { describe, expect, it, vi } from 'vitest';

import { avirx, endpoint } from 'avirx';

describe('concurrency policy', () => {
    it('limits in-flight fetches and queues FIFO across cloned clients', async () => {
        const fetches: Array<Deferred<Response>> = [];
        const order: string[] = [];
        let active = 0;
        let maxActive = 0;
        const fetchImpl = vi.fn<typeof fetch>(async (input) => {
            const url = fetchInputUrl(input);
            const deferred = createDeferred<Response>();

            order.push(url.pathname);
            active += 1;
            maxActive = Math.max(maxActive, active);
            fetches.push(deferred);

            return deferred.promise.finally(() => {
                active -= 1;
            });
        });

        const base = avirx('https://api.example.com', { fetch: fetchImpl }).concurrency(1);
        const clone = base.header('x-client', 'clone');

        const first = base.get('/first').send();
        await waitFor(() => fetchImpl.mock.calls.length === 1);

        const second = clone.get('/second').send();
        const third = base.get('/third').send();
        await waitFor(() => base.state.concurrency?.queued() === 2);

        expect(fetchImpl).toHaveBeenCalledTimes(1);
        expect(base.state.concurrency).toBe(clone.state.concurrency);
        expect(base.state.concurrency?.active()).toBe(1);
        expect(maxActive).toBe(1);

        fetches[0]?.resolve(new Response('first'));
        await first;
        await waitFor(() => fetchImpl.mock.calls.length === 2);
        expect(order).toEqual(['/first', '/second']);

        fetches[1]?.resolve(new Response('second'));
        await second;
        await waitFor(() => fetchImpl.mock.calls.length === 3);
        expect(order).toEqual(['/first', '/second', '/third']);

        fetches[2]?.resolve(new Response('third'));
        await third;

        expect(maxActive).toBe(1);
        expect(base.state.concurrency?.active()).toBe(0);
        expect(base.state.concurrency?.queued()).toBe(0);
    });

    it('drains large FIFO queues without losing order', async () => {
        const order: string[] = [];
        const fetchImpl = vi.fn<typeof fetch>(async (input) => {
            order.push(fetchInputUrl(input).pathname);
            return Promise.resolve(new Response('ok'));
        });
        const client = avirx('https://api.example.com', { fetch: fetchImpl }).concurrency(1);
        const count = 100;

        await Promise.all(
            Array.from({ length: count }, async (_value, index) =>
                client.get(`/queued-${String(index)}`).send(),
            ),
        );

        expect(order).toEqual(
            Array.from({ length: count }, (_value, index) => `/queued-${String(index)}`),
        );
        expect(client.state.concurrency?.active()).toBe(0);
        expect(client.state.concurrency?.queued()).toBe(0);
    });

    it('releases slots after network failures', async () => {
        const fetchImpl = vi
            .fn<typeof fetch>()
            .mockRejectedValueOnce(new Error('socket broke'))
            .mockResolvedValueOnce(new Response('ok'));
        const client = avirx('https://api.example.com', { fetch: fetchImpl }).concurrency(1);

        await expect(client.get('/fail').send()).rejects.toMatchObject({
            message: 'Request failed.',
        });
        await expect(client.get('/ok').text()).resolves.toBe('ok');

        expect(fetchImpl).toHaveBeenCalledTimes(2);
        expect(client.state.concurrency?.active()).toBe(0);
    });

    it('releases slots after request hook failures', async () => {
        const fetchImpl = vi.fn<typeof fetch>(async () => Promise.resolve(new Response('ok')));
        const client = avirx('https://api.example.com', { fetch: fetchImpl }).concurrency(1);

        await expect(
            client
                .get('/hook-fails')
                .on('request', () => {
                    throw new Error('bad hook');
                })
                .send(),
        ).rejects.toMatchObject({
            message: 'Request failed.',
        });
        await expect(client.get('/ok').text()).resolves.toBe('ok');

        expect(fetchImpl).toHaveBeenCalledOnce();
        expect(client.state.concurrency?.active()).toBe(0);
    });

    it('releases slots after timeout failures', async () => {
        const fetchImpl = vi.fn<typeof fetch>(async (input, init) => {
            const url = fetchInputUrl(input);

            if (url.pathname === '/slow') {
                return new Promise<Response>((_resolve, reject) => {
                    init?.signal?.addEventListener('abort', () => {
                        reject(new DOMException('Aborted', 'AbortError'));
                    });
                });
            }

            return Promise.resolve(new Response('ok'));
        });
        const client = avirx('https://api.example.com', { fetch: fetchImpl }).concurrency(1);

        await expect(client.get('/slow').timeout('1ms').send()).rejects.toMatchObject({
            message: 'Request timed out.',
        });
        await expect(client.get('/fast').text()).resolves.toBe('ok');

        expect(fetchImpl).toHaveBeenCalledTimes(2);
        expect(client.state.concurrency?.active()).toBe(0);
    });

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
