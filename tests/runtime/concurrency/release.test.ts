import { describe, expect, it, vi } from 'vitest';
import { avirx } from 'avirx';

describe('concurrency policy', () => {
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
