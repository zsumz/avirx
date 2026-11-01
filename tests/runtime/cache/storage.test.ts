import { afterEach, describe, expect, it, vi } from 'vitest';
import { avirx } from 'avirx';
import { publicResponse } from '../../helpers/public-response.js';

describe('cache policy', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it('caches GET success responses with fresh readable bodies', async () => {
        const fetchImpl = vi.fn<typeof fetch>(async () =>
            Promise.resolve(publicResponse(JSON.stringify({ count: 1 }), {
                headers: { 'content-type': 'application/json' },
            })),
        );
        const client = avirx('https://api.example.com', { fetch: fetchImpl }).cache({ ttl: '1s' });

        const first = await client.get('/stats').json<{ count: number }>();
        const second = await client.get('/stats').json<{ count: number }>();
        const responseA = await client.get('/stats').send();
        const responseB = await client.get('/stats').send();

        expect(first).toEqual({ count: 1 });
        expect(second).toEqual({ count: 1 });
        await expect(responseA.native.text()).resolves.toBe(JSON.stringify({ count: 1 }));
        await expect(responseB.native.text()).resolves.toBe(JSON.stringify({ count: 1 }));
        expect(fetchImpl).toHaveBeenCalledOnce();
        expect(client.state.cache?.size()).toBe(1);
    });

    it('caches download terminal responses', async () => {
        const fetchImpl = vi.fn<typeof fetch>(async () =>
            Promise.resolve(publicResponse('export', {
                headers: {
                    'content-disposition': 'attachment; filename="export.txt"',
                    'content-type': 'text/plain',
                },
            })),
        );
        const client = avirx('https://api.example.com', { fetch: fetchImpl }).cache({ ttl: '1s' });

        const first = await client.get('/exports/latest').download();
        const second = await client.get('/exports/latest').download();

        await expect(first.blob.text()).resolves.toBe('export');
        await expect(second.blob.text()).resolves.toBe('export');
        expect(second.filename).toBe('export.txt');
        expect(fetchImpl).toHaveBeenCalledOnce();
    });

    it('skips caching responses larger than maxBytes', async () => {
        const fetchImpl = vi
            .fn<typeof fetch>()
            .mockResolvedValueOnce(publicResponse('large', {
                headers: { 'content-length': '5' },
            }))
            .mockResolvedValueOnce(publicResponse('ok', {
                headers: { 'content-length': '2' },
            }));
        const client = avirx('https://api.example.com', { fetch: fetchImpl }).cache({
            maxBytes: 2,
            ttl: '1s',
        });

        await expect(client.get('/stats').text()).resolves.toBe('large');
        await expect(client.get('/stats').text()).resolves.toBe('ok');
        await expect(client.get('/stats').text()).resolves.toBe('ok');

        expect(fetchImpl).toHaveBeenCalledTimes(2);
        expect(client.state.cache?.size()).toBe(1);
    });

    it('skips caching unknown-size responses when maxBytes is configured', async () => {
        const fetchImpl = vi
            .fn<typeof fetch>()
            .mockResolvedValueOnce(publicResponse('ok'))
            .mockResolvedValueOnce(publicResponse('fresh'));
        const client = avirx('https://api.example.com', { fetch: fetchImpl }).cache({
            maxBytes: 2,
            ttl: '1s',
        });

        await expect(client.get('/stats').text()).resolves.toBe('ok');
        await expect(client.get('/stats').text()).resolves.toBe('fresh');

        expect(fetchImpl).toHaveBeenCalledTimes(2);
        expect(client.state.cache?.size()).toBe(0);
    });

    it('skips caching download responses larger than maxBytes', async () => {
        const fetchImpl = vi.fn<typeof fetch>(async () =>
            Promise.resolve(publicResponse('export', {
                headers: {
                    'content-disposition': 'attachment; filename="export.txt"',
                    'content-type': 'text/plain',
                },
            })),
        );
        const client = avirx('https://api.example.com', { fetch: fetchImpl }).cache({
            maxBytes: 3,
            ttl: '1s',
        });

        const first = await client.get('/exports/latest').download();
        const second = await client.get('/exports/latest').download();

        await expect(first.blob.text()).resolves.toBe('export');
        await expect(second.blob.text()).resolves.toBe('export');
        expect(fetchImpl).toHaveBeenCalledTimes(2);
        expect(client.state.cache?.size()).toBe(0);
    });
});
