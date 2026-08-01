import { afterEach, describe, expect, it, vi } from 'vitest';
import { avirx } from 'avirx';

describe('fetch execution', () => {
    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('clears timeout timers after successful fetches', async () => {
        const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
        const fetchImpl = vi.fn<typeof fetch>(async () => Promise.resolve(new Response('ok')));

        await avirx('https://api.example.com', { fetch: fetchImpl }).timeout('5s').get('/fast').send();

        expect(clearTimeoutSpy).toHaveBeenCalledOnce();
    });

    it('lets request-level timeout override client timeout', async () => {
        const fetchImpl = vi.fn<typeof fetch>(
            async (_input, init) =>
                new Promise<Response>((_resolve, reject) => {
                    init?.signal?.addEventListener('abort', () => {
                        reject(new DOMException('Aborted', 'AbortError'));
                    });
                }),
        );

        await expect(
            avirx('https://api.example.com', { fetch: fetchImpl })
                .timeout('5s')
                .get('/slow')
                .timeout('1ms')
                .send(),
        ).rejects.toMatchObject({
            message: 'Request timed out.',
            request: {
                timeoutMs: 1,
            },
        });
    });

    it('lets request-level timeout disable client timeout', async () => {
        const fetchImpl = vi.fn<typeof fetch>(async () => Promise.resolve(new Response('ok')));

        await avirx('https://api.example.com', { fetch: fetchImpl })
            .timeout('1ms')
            .get('/fast')
            .timeout(false)
            .send();

        const init = fetchImpl.mock.calls[0]?.[1];
        expect(init?.signal).toBeUndefined();
    });
});
