import { describe, expect, it, vi } from 'vitest';
import { avirx } from 'avirx';

describe('HTTP method builders', () => {
    it('generates unredacted curl only when explicitly requested', async () => {
        const curl = await avirx('https://api.example.com')
            .auth.apiKey('X-Api-Key', () => 'secret-key')
            .get('/events')
            .curl({ redacted: false });

        expect(curl).toBe(
            [
                'curl -X GET \'https://api.example.com/events\'',
                '  -H \'x-api-key: secret-key\'',
            ].join(' \\\n'),
        );
    });

    it.each(['X-Auth-Token', 'Private-Token', 'X-Custom-Key'] as const)(
        'redacts auth-created custom API key header %s',
        async (headerName) => {
            const api = avirx('https://api.example.com')
                .auth.apiKey(headerName, () => 'secret-key');
            const normalizedHeaderName = headerName.toLowerCase();

            const built = await api.get('/events').build();
            const preview = await api.get('/events').preview();
            const curl = await api.get('/events').curl();

            expect(built.headers[normalizedHeaderName]).toBe('secret-key');
            expect(built.redactedHeaders[normalizedHeaderName]).toBe('[redacted]');
            expect(built.sensitiveHeaders).toEqual([normalizedHeaderName]);
            expect(preview.headers[normalizedHeaderName]).toBe('[redacted]');
            expect(preview.redactions.headers[normalizedHeaderName]).toBe('[redacted]');
            expect(curl).toContain(`-H '${normalizedHeaderName}: [redacted]'`);
            expect(curl).not.toContain('secret-key');
        },
    );

    it('keeps auth-created custom API key headers unredacted only by explicit curl request', async () => {
        const curl = await avirx('https://api.example.com')
            .auth.apiKey('X-Auth-Token', () => 'secret-key')
            .get('/events')
            .curl({ redacted: false });

        expect(curl).toContain('-H \'x-auth-token: secret-key\'');
    });

    it('previews requests without executing fetch', async () => {
        const fetchImpl = vi.fn<typeof fetch>(async () => Promise.resolve(new Response('unused')));

        const preview = await avirx('https://api.example.com', { fetch: fetchImpl })
            .auth.query('api_key', () => 'secret-key')
            .post('/events')
            .headers({ Authorization: 'Bearer token' })
            .body({ ok: true })
            .preview();

        expect(fetchImpl).not.toHaveBeenCalled();
        expect(preview).toEqual({
            body: '{"ok":true}',
            curl: [
                'curl -X POST \'https://api.example.com/events?api_key=%5Bredacted%5D\'',
                '  -H \'authorization: [redacted]\'',
                '  -H \'content-type: application/json\'',
                '  --data-raw \'{"ok":true}\'',
            ].join(' \\\n'),
            headers: {
                authorization: '[redacted]',
                'content-type': 'application/json',
            },
            method: 'POST',
            redactions: {
                headers: {
                    authorization: '[redacted]',
                    'content-type': 'application/json',
                },
                url: 'https://api.example.com/events?api_key=%5Bredacted%5D',
            },
            url: 'https://api.example.com/events?api_key=%5Bredacted%5D',
        });
        expect(Object.isFrozen(preview)).toBe(true);
    });
});
