import { describe, expect, it, vi } from 'vitest';
import { avirx, AvirxError } from 'avirx';

describe('callback failure identity', () => {
    it.each([undefined, null, 'callback failed', 42])('preserves the thrown callback value %s', async (value) => {
        const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}'));
        const execution = avirx('https://api.example.com', { fetch: fetchImpl }).get('/')
            .on('response', () => {
                // eslint-disable-next-line @typescript-eslint/only-throw-error -- Exercise caller-thrown primitives.
                throw value;
            })
            .result();

        await expect(execution).rejects.toBe(value);
    });

    it('rejects an auth provider AvirxError without treating it as an operation result', async () => {
        const sibling = new AvirxError('Token request failed.', {
            request: await avirx('https://auth.example.com').post('/token').build(),
            status: 401,
        });
        const fetchImpl = vi.fn<typeof fetch>();
        expect(sibling.kind).toBe('unknown');
        const errorHook = vi.fn();
        const execution = avirx('https://api.example.com', { fetch: fetchImpl })
            .auth.bearer(() => {
                throw sibling;
            })
            .on('error', errorHook)
            .get('/')
            .result();

        await expect(execution).rejects.toBe(sibling);
        expect(fetchImpl).not.toHaveBeenCalled();
        expect(errorHook).not.toHaveBeenCalled();
    });
});
