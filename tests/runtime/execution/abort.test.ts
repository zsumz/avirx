import { afterEach, describe, expect, it, vi } from 'vitest';
import { avirx } from 'avirx';

describe('fetch execution', () => {
    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('passes composed client and request signals to fetch', async () => {
        const clientController = new AbortController();
        const requestController = new AbortController();
        const fetchImpl = vi.fn<typeof fetch>(async () => Promise.resolve(new Response('ok')));

        await avirx('https://api.example.com', { fetch: fetchImpl })
            .signal(clientController.signal)
            .get('/slow')
            .signal(requestController.signal)
            .send();

        const init = fetchImpl.mock.calls[0]?.[1];
        expect(init?.signal).toBeInstanceOf(AbortSignal);
        expect(init?.signal).not.toBe(clientController.signal);
        expect(init?.signal).not.toBe(requestController.signal);
    });

    it('aborts before cache lookup or fetch when the external signal is already aborted', async () => {
        const controller = new AbortController();
        const errors: string[] = [];
        const fetchImpl = vi.fn<typeof fetch>(async () => Promise.resolve(new Response('live')));
        const client = avirx('https://api.example.com', { fetch: fetchImpl })
            .cache({ ttl: '1s' })
            .on('error', (context) => {
                errors.push(context.error()?.message ?? 'missing');
            });

        await client.get('/cached').text();
        controller.abort(new Error('cancelled'));

        await expect(client.get('/cached').signal(controller.signal).text()).rejects.toMatchObject({
            message: 'Request aborted.',
            request: {
                url: new URL('https://api.example.com/cached'),
            },
        });
        expect(fetchImpl).toHaveBeenCalledOnce();
        expect(errors).toEqual(['Request aborted.']);
    });

    it('wraps fetch aborts from external signals', async () => {
        const controller = new AbortController();
        const fetchImpl = vi.fn<typeof fetch>(
            async (_input, init) =>
                new Promise<Response>((_resolve, reject) => {
                    init?.signal?.addEventListener('abort', () => {
                        reject(new DOMException('Aborted', 'AbortError'));
                    });
                }),
        );

        const request = avirx('https://api.example.com', { fetch: fetchImpl })
            .signal(controller.signal)
            .get('/slow')
            .send();
        controller.abort('cancelled');

        await expect(request).rejects.toMatchObject({
            message: 'Request aborted.',
            name: 'AvirxError',
            request: {
                method: 'GET',
            },
        });
    });

    it('returns result-mode errors for external aborts', async () => {
        const controller = new AbortController();
        const fetchImpl = vi.fn<typeof fetch>(async () => Promise.resolve(new Response('ok')));
        controller.abort('cancelled');

        const result = await avirx('https://api.example.com', { fetch: fetchImpl })
            .signal(controller.signal)
            .get('/users')
            .result();

        expect(result.ok).toBe(false);
        if (result.ok) {
            throw new Error('Expected aborted result.');
        }
        expect(result.error.message).toBe('Request aborted.');
        expect(result.status).toBeUndefined();
        expect(result.response).toBeUndefined();
        expect(fetchImpl).not.toHaveBeenCalled();
    });
});
