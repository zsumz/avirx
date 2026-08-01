import { afterEach, describe, expect, it, vi } from 'vitest';
import { avirx } from 'avirx';

describe('fetch execution', () => {
    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('retries idempotent requests for configured statuses', async () => {
        const fetchImpl = vi
            .fn<typeof fetch>()
            .mockResolvedValueOnce(new Response('busy', { status: 503 }))
            .mockResolvedValueOnce(new Response('ok'));

        const response = await avirx('https://api.example.com', { fetch: fetchImpl })
            .get('/users')
            .retry({ attempts: 1, on: [503] })
            .send();

        expect(fetchImpl).toHaveBeenCalledTimes(2);
        expect(response.status).toBe(200);
        expect(response.request.retry).toEqual({
            attempts: 1,
            on: [503],
            safeOnly: true,
        });
        expect(response.timing.retryEvents).toEqual([
            {
                attempt: 1,
                delayMs: 10,
                status: 503,
            },
        ]);
    });

    it('does not retry transport failures', async () => {
        const cause = new Error('socket broke');
        const fetchImpl = vi.fn<typeof fetch>(async () => Promise.reject(cause));

        await expect(
            avirx('https://api.example.com', { fetch: fetchImpl }).get('/users').retry(3).send(),
        ).rejects.toMatchObject({
            cause,
            message: 'Request failed.',
        });
        expect(fetchImpl).toHaveBeenCalledOnce();
    });
});
