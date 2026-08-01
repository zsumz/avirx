import { afterEach, describe, expect, it, vi } from 'vitest';
import { avirx } from 'avirx';

describe('fetch execution', () => {
    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('does not retry non-idempotent methods by default', async () => {
        const fetchImpl = vi.fn<typeof fetch>(async () =>
            Promise.resolve(new Response('busy', { status: 503 })),
        );

        await expect(
            avirx('https://api.example.com', { fetch: fetchImpl }).post('/events').retry(1).send(),
        ).rejects.toMatchObject({
            status: 503,
        });
        expect(fetchImpl).toHaveBeenCalledOnce();
    });

    it('lets request-level retry override client retry', async () => {
        const fetchImpl = vi.fn<typeof fetch>(async () =>
            Promise.resolve(new Response('busy', { status: 503 })),
        );

        await expect(
            avirx('https://api.example.com', { fetch: fetchImpl })
                .retry(3)
                .get('/users')
                .retry(0)
                .send(),
        ).rejects.toMatchObject({
            request: {
                retry: {
                    attempts: 0,
                },
            },
            status: 503,
        });
        expect(fetchImpl).toHaveBeenCalledOnce();
    });

    it('skips retries for non-replayable bodies', async () => {
        const fetchImpl = vi.fn<typeof fetch>(async () =>
            Promise.resolve(new Response('busy', { status: 503 })),
        );

        await expect(
            avirx('https://api.example.com', { fetch: fetchImpl })
                .put('/upload')
                .body(new ReadableStream<Uint8Array>())
                .retry(1)
                .send(),
        ).rejects.toMatchObject({
            status: 503,
        });
        expect(fetchImpl).toHaveBeenCalledOnce();
    });
});
