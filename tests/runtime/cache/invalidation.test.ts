import { describe, expect, it, vi } from 'vitest';
import { avirx } from 'avirx';
import { publicResponse } from '../../helpers/public-response.js';

describe('cache clear across outstanding operations', () => {
    it('does not cache a response from a fetch started before clear', async () => {
        const firstResponse = deferred<Response>();
        const started = deferred<undefined>();
        const fetchImpl = vi.fn<typeof fetch>()
            .mockImplementationOnce(async () => {
                started.resolve(undefined);
                return firstResponse.promise;
            })
            .mockImplementation(async () => Promise.resolve(publicResponse('fresh')));
        const client = avirx('https://example.com', { fetch: fetchImpl }).cache({ ttl: '1s' });
        const request = client.get('/catalog');
        const pending = request.text();
        await started.promise;
        client.state.cache?.clear();
        firstResponse.resolve(publicResponse('stale'));

        expect(await pending).toBe('stale');
        expect(client.state.cache?.size()).toBe(0);
        expect(await request.text()).toBe('fresh');
        expect(await request.text()).toBe('fresh');
        expect(fetchImpl).toHaveBeenCalledTimes(2);
    });

    it('does not cache an operation waiting in a request hook before clear', async () => {
        const release = deferred<undefined>();
        const started = deferred<undefined>();
        const fetchImpl = vi.fn<typeof fetch>()
            .mockImplementationOnce(async () => Promise.resolve(publicResponse('stale')))
            .mockImplementation(async () => Promise.resolve(publicResponse('fresh')));
        let hooks = 0;
        const client = avirx('https://example.com', { fetch: fetchImpl }).cache({ ttl: '1s' })
            .on('request', async () => {
                hooks += 1;
                if (hooks === 1) {
                    started.resolve(undefined);
                    await release.promise;
                }
            });
        const pending = client.get('/catalog').text();
        await started.promise;
        client.state.cache?.clear();
        release.resolve(undefined);

        expect(await pending).toBe('stale');
        expect(client.state.cache?.size()).toBe(0);
        expect(await client.get('/catalog').text()).toBe('fresh');
        expect(fetchImpl).toHaveBeenCalledTimes(2);
    });

    it('does not cache when clear happens during asynchronous validation', async () => {
        const release = deferred<undefined>();
        const started = deferred<undefined>();
        const fetchImpl = vi.fn<typeof fetch>()
            .mockImplementationOnce(async () => Promise.resolve(publicResponse('"stale"')))
            .mockImplementation(async () => Promise.resolve(publicResponse('"fresh"')));
        let validations = 0;
        const schema = {
            async parse(input: unknown): Promise<unknown> {
                validations += 1;
                if (validations === 1) {
                    started.resolve(undefined);
                    await release.promise;
                }
                return input;
            },
        };
        const client = avirx('https://example.com', { fetch: fetchImpl }).cache({ ttl: '1s' });
        const pending = client.get('/catalog').as(schema);
        await started.promise;
        client.state.cache?.clear();
        release.resolve(undefined);

        expect(await pending).toBe('stale');
        expect(client.state.cache?.size()).toBe(0);
        expect(await client.get('/catalog').as(schema)).toBe('fresh');
        expect(fetchImpl).toHaveBeenCalledTimes(2);
    });

    it('keeps earlier operations invalidated across retries', async () => {
        const release = deferred<undefined>();
        const retrying = deferred<undefined>();
        const fetchImpl = vi.fn<typeof fetch>()
            .mockImplementationOnce(async () => Promise.resolve(publicResponse('retry', { status: 503 })))
            .mockImplementationOnce(async () => Promise.resolve(publicResponse('stale')))
            .mockImplementation(async () => Promise.resolve(publicResponse('fresh')));
        const client = avirx('https://example.com', { fetch: fetchImpl }).cache({ ttl: '1s' })
            .retry(1)
            .on('retry', async () => {
                retrying.resolve(undefined);
                await release.promise;
            });
        const pending = client.get('/catalog').text();
        await retrying.promise;
        client.state.cache?.clear();
        release.resolve(undefined);

        expect(await pending).toBe('stale');
        expect(client.state.cache?.size()).toBe(0);
        expect(await client.get('/catalog').text()).toBe('fresh');
        expect(fetchImpl).toHaveBeenCalledTimes(3);
    });
});

function deferred<T>(): Readonly<{ promise: Promise<T>; resolve(value: T): void }> {
    let resolve!: (value: T) => void;
    const promise: Promise<T> = new Promise((resolvePromise) => {
        resolve = resolvePromise;
    });
    return { promise, resolve };
}
