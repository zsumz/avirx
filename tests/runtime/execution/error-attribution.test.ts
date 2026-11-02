import { afterEach, describe, expect, it, vi } from 'vitest';
import { avirx, AvirxError } from 'avirx';

describe('current request error attribution', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it.each(['preflight', 'fetch', 'concurrency', 'rate', 'retry'] as const)(
        'retains a sibling abort reason without adopting its metadata during %s',
        async (phase) => {
            vi.useFakeTimers();
            const siblingRequest = await avirx('https://sibling.example.com').get('/sibling').build();
            const sibling = new AvirxError('Sibling HTTP failure.', { request: siblingRequest, status: 409 });
            const controller = new AbortController();
            const fetchImpl = vi.fn<typeof fetch>();
            if (phase === 'fetch') {
                fetchImpl.mockImplementation(async (_input, init) => new Promise((_resolve, reject) => {
                    init?.signal?.addEventListener('abort', () => {
                        reject(sibling);
                    }, { once: true });
                }));
            } else {
                fetchImpl.mockResolvedValue(new Response('{}', { status: phase === 'retry' ? 503 : 200 }));
            }
            const base = avirx('https://current.example.com', { fetch: fetchImpl });
            const client = phase === 'concurrency' ? base.concurrency(1) : phase === 'rate'
                ? base.rateLimit({ per: '1s', requests: 1 })
                : base;
            const release = phase === 'concurrency' ? await client.state.concurrency?.acquire() : undefined;
            if (phase === 'rate') {
                await client.state.rateLimit?.acquire(await client.get('/seed').build());
            }
            if (phase === 'preflight') controller.abort(sibling);
            const errorHook = vi.fn();
            const execution = client.get('/current')
                .signal(controller.signal)
                .retry(phase === 'retry' ? 1 : 0)
                .on('error', errorHook)
                .result();
            await vi.advanceTimersByTimeAsync(0);
            if (phase === 'concurrency') expect(client.state.concurrency?.queued()).toBe(1);
            if (phase === 'rate') expect(client.state.rateLimit?.queued()).toBe(1);
            controller.abort(sibling);
            const result = await execution;
            release?.();

            expect(result.ok).toBe(false);
            if (result.ok) throw new Error('Expected aborted result.');
            expect(result.error).toMatchObject({ kind: 'aborted', message: 'Request aborted.' });
            expect(result.error).not.toBe(sibling);
            expect(result.error.cause).toBe(sibling);
            expect(result.error.request.url.href).toBe('https://current.example.com/current');
            expect(result.error.response).toBeUndefined();
            expect(result.error.status).toBeUndefined();
            expect(errorHook).toHaveBeenCalledOnce();
        },
    );

    it('normalizes a fetch rejection containing another request error', async () => {
        const siblingRequest = await avirx('https://sibling.example.com').get('/').build();
        const sibling = new AvirxError('Sibling HTTP failure.', { request: siblingRequest, status: 404 });
        const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(sibling);

        const result = await avirx('https://current.example.com', { fetch: fetchImpl }).get('/current').result();

        expect(result.ok).toBe(false);
        if (result.ok) throw new Error('Expected failed result.');
        expect(result.error).toMatchObject({ cause: sibling, kind: 'network', message: 'Request failed.' });
        expect(result.error.request.url.href).toBe('https://current.example.com/current');
        expect(result.error.status).toBeUndefined();
    });
});
