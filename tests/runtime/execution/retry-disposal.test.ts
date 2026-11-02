import { describe, expect, it, vi } from 'vitest';
import { avirx } from 'avirx';

describe('discarded response disposal', () => {
    it('cancels a retry response before dispatching the next attempt', async () => {
        const cancel = vi.fn();
        const failed = new Response(new ReadableStream({ cancel }), { status: 503 });
        let calls = 0;
        const fetchImpl = vi.fn<typeof fetch>(async () => {
            calls += 1;
            if (calls === 1) {
                return Promise.resolve(failed);
            }
            expect(cancel).toHaveBeenCalledOnce();
            return Promise.resolve(new Response('ready'));
        });

        await expect(avirx('https://api.example.com', { fetch: fetchImpl }).retry(1).get('/').text())
            .resolves.toBe('ready');
        expect(fetchImpl).toHaveBeenCalledTimes(2);
        expect(cancel).toHaveBeenCalledOnce();
    });

    it.each(['response', 'retry'] as const)('cancels the response when a %s hook fails', async (event) => {
        const cause = new Error('hook failed');
        const cancel = vi.fn();
        const native = new Response(new ReadableStream({ cancel }), { status: 503 });
        const fetchImpl = vi.fn<typeof fetch>(async () => Promise.resolve(native));
        const request = avirx('https://api.example.com', { fetch: fetchImpl })
            .retry(1)
            .get('/')
            .on(event, () => {
                throw cause;
            });

        await expect(request.send()).rejects.toBe(cause);
        expect(fetchImpl).toHaveBeenCalledOnce();
        expect(cancel).toHaveBeenCalledOnce();
    });

    it('preserves hook failures when body cancellation rejects', async () => {
        const cause = new Error('hook failed');
        const cancel = vi.fn(() => {
            throw new Error('cancellation failed');
        });
        const native = new Response(new ReadableStream({ cancel }), { status: 503 });
        const fetchImpl = vi.fn<typeof fetch>(async () => Promise.resolve(native));

        await expect(avirx('https://api.example.com', { fetch: fetchImpl })
            .retry(1)
            .get('/')
            .on('retry', () => {
                throw cause;
            })
            .send()).rejects.toBe(cause);
        expect(cancel).toHaveBeenCalledOnce();
    });

    it('does not wait forever for discarded body cancellation to settle', async () => {
        const cancel = vi.fn(async () => new Promise<void>(() => undefined));
        const fetchImpl = vi.fn<typeof fetch>()
            .mockResolvedValueOnce(new Response(new ReadableStream({ cancel }), { status: 503 }))
            .mockResolvedValueOnce(new Response('ready'));

        await expect(avirx('https://api.example.com', { fetch: fetchImpl }).retry(1).get('/').text())
            .resolves.toBe('ready');
        expect(cancel).toHaveBeenCalledOnce();
    });
});
