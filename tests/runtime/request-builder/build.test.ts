import { describe, expect, it, vi } from 'vitest';
import { avirx } from 'avirx';

describe('HTTP method builders', () => {
    it('builds inspectable requests without executing fetch', async () => {
        const fetchImpl = vi.fn<typeof fetch>(async () => Promise.resolve(new Response('unused')));
        const token = vi.fn(() => 'secret-token');

        const built = await avirx('https://api.example.com/v1', { fetch: fetchImpl })
            .auth.query('api_key', token)
            .headers({ Authorization: 'Bearer client-token' })
            .timeout('5s')
            .retry({ attempts: 2, on: [503] })
            .post('/events/{id}?existing=1')
            .path({ id: 'evt 123' })
            .query({ tag: ['a', 'b'] })
            .header('X-Request', 'req_123')
            .body({ ok: true })
            .build();

        expect(fetchImpl).not.toHaveBeenCalled();
        expect(token).toHaveBeenCalledOnce();
        expect(built.method).toBe('POST');
        expect(built.url.href).toBe(
            'https://api.example.com/v1/events/evt%20123?existing=1&api_key=secret-token&tag=a&tag=b',
        );
        expect(built.redactedUrl.href).toBe(
            'https://api.example.com/v1/events/evt%20123?existing=1&api_key=%5Bredacted%5D&tag=a&tag=b',
        );
        expect(built.headers).toEqual({
            authorization: 'Bearer client-token',
            'content-type': 'application/json',
            'x-request': 'req_123',
        });
        expect(built.redactedHeaders.authorization).toBe('[redacted]');
        expect(built.body).toBe('{"ok":true}');
        expect(built.bodyMetadata).toMatchObject({
            contentLength: 11,
            contentType: 'application/json',
            kind: 'json',
        });
        expect(built.timeoutMs).toBe(5000);
        expect(built.retry).toEqual({
            attempts: 2,
            on: [503],
            safeOnly: true,
        });
        expect(Object.isFrozen(built)).toBe(true);
    });

    it('exposes built request URL snapshots', async () => {
        const built = await avirx('https://api.example.com')
            .auth.query('api_key', () => 'secret-key')
            .get('/events')
            .build();
        const url = built.url;
        const redactedUrl = built.redactedUrl;

        url.pathname = '/rewritten';
        redactedUrl.pathname = '/rewritten-redacted';

        expect(built.url.href).toBe('https://api.example.com/events?api_key=secret-key');
        expect(built.redactedUrl.href).toBe(
            'https://api.example.com/events?api_key=%5Bredacted%5D',
        );
    });

    it('generates stable redacted curl by default', async () => {
        const curl = await avirx('https://api.example.com')
            .auth.query('api_key', () => 'secret-key')
            .post('/events')
            .headers({ 'X-Request': 'req_123', Authorization: 'Bearer token' })
            .body({ ok: true })
            .curl();

        expect(curl).toBe(
            [
                'curl -X POST \'https://api.example.com/events?api_key=%5Bredacted%5D\'',
                '  -H \'authorization: [redacted]\'',
                '  -H \'content-type: application/json\'',
                '  -H \'x-request: req_123\'',
                '  --data-raw \'{"ok":true}\'',
            ].join(' \\\n'),
        );
    });
});
