import { describe, expect, it, vi } from 'vitest';
import { avirx, type AvirxHookHandler } from 'avirx';

describe('buffered response body failures', () => {
    it.each(['text', 'download'] as const)('normalizes %s failures and runs error hooks once', async (terminal) => {
        const cause = new Error('response socket failed');
        const native = new Response(new ReadableStream({
            start(controller) {
                controller.error(cause);
            },
        }));
        const fetchImpl = vi.fn<typeof fetch>(async () => Promise.resolve(native));
        const errorHook = vi.fn<AvirxHookHandler>();
        const request = avirx('https://api.example.com', { fetch: fetchImpl })
            .get('/broken')
            .on('error', errorHook);

        await expect(request[terminal]()).rejects.toMatchObject({
            cause,
            kind: 'decode',
            name: 'AvirxError',
            request: { method: 'GET' },
            response: { native, status: 200 },
            status: 200,
        });
        expect(errorHook).toHaveBeenCalledOnce();
        expect(errorHook.mock.calls[0]?.[0].error()).toMatchObject({ cause, status: 200 });
        expect(errorHook.mock.calls[0]?.[0].response()?.native).toBe(native);
    });
});
