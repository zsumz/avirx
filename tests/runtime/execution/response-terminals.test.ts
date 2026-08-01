import { afterEach, describe, expect, it, vi } from 'vitest';
import { AvirxError, avirx } from 'avirx';

describe('fetch execution', () => {
    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('parses JSON responses', async () => {
        const fetchImpl = vi.fn<typeof fetch>(async () =>
            Promise.resolve(new Response(JSON.stringify({ id: 'usr_123' }))),
        );

        const user = await avirx('https://api.example.com', { fetch: fetchImpl })
            .get('/users/{id}')
            .path({ id: 'usr_123' })
            .json<{ id: string }>();

        expect(user.id).toBe('usr_123');
    });

    it('returns undefined JSON data for 204 and 205 responses', async () => {
        const fetchImpl = vi.fn<typeof fetch>(async () => Promise.resolve(new Response(null, { status: 204 })));

        const data = await avirx('https://api.example.com', { fetch: fetchImpl }).delete('/users/{id}').path({
            id: 'usr_123',
        }).json();

        expect(data).toBeUndefined();
    });

    it('parses HEAD responses as empty text without reading JSON', async () => {
        const fetchImpl = vi.fn<typeof fetch>(async () => Promise.resolve(new Response(null, { status: 200 })));

        await expect(avirx('https://api.example.com', { fetch: fetchImpl }).head('/users').text()).resolves.toBe(
            '',
        );
        await expect(
            avirx('https://api.example.com', { fetch: fetchImpl }).head('/users').json(),
        ).rejects.toMatchObject({
            message: 'Failed to parse response JSON.',
        });
    });

    it('throws AvirxError for invalid JSON', async () => {
        const fetchImpl = vi.fn<typeof fetch>(async () => Promise.resolve(new Response('not-json')));
        const errors: string[] = [];

        await expect(
            avirx('https://api.example.com', { fetch: fetchImpl })
                .on('error', (context) => {
                    errors.push(context.error()?.message ?? 'missing');
                    expect(context.response()?.status).toBe(200);
                    expect(context.request().url.href).toBe('https://api.example.com/broken');
                })
                .get('/broken')
                .json(),
        ).rejects.toThrow(AvirxError);
        expect(errors).toEqual(['Failed to parse response JSON.']);

        const hookError = new Error('hook failed');
        await expect(
            avirx('https://api.example.com', { fetch: fetchImpl })
                .on('error', () => {
                    throw hookError;
                })
                .get('/broken')
                .json(),
        ).rejects.toBe(hookError);
    });

    it('parses text responses', async () => {
        const fetchImpl = vi.fn<typeof fetch>(async () => Promise.resolve(new Response('hello')));

        await expect(avirx('https://api.example.com', { fetch: fetchImpl }).get('/hello').text()).resolves.toBe(
            'hello',
        );
    });
});
