import { describe, expect, it, vi } from 'vitest';
import { avirx } from 'avirx';

describe('credential redirect options', () => {
    it.each([true, false])('preserves explicit %s through derived clients', async (allowCredentialRedirects) => {
        const fetchImpl = vi.fn<typeof fetch>(async () => Promise.resolve(new Response('ready')));
        const client = avirx('https://example.com', { allowCredentialRedirects, fetch: fetchImpl })
            .header('x-derived', 'yes')
            .auth.apiKey('x-custom-token', () => 'fake-secret');

        expect(client.state.allowCredentialRedirects).toBe(allowCredentialRedirects);
        await client.get('/').send();
        expect(fetchImpl.mock.calls[0]?.[1]?.redirect).toBe(allowCredentialRedirects ? undefined : 'error');
    });

    it.each([1, 'true', null])('rejects a nonboolean opt-in %s', (allowCredentialRedirects) => {
        expect(() => avirx('https://example.com', { allowCredentialRedirects } as never))
            .toThrow('allowCredentialRedirects must be a boolean.');
    });
});
