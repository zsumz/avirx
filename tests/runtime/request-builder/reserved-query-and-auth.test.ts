import { describe, expect, it, vi } from 'vitest';
import { avirx } from 'avirx';

describe('reserved names and query authentication', () => {
    it.each(['constructor', '__proto__', 'toString', ''] as const)(
        'preserves valid repeated URLSearchParams key %s exactly',
        async (name) => {
            const api = avirx('https://example.com');
            const request = api.get('/').query(new URLSearchParams([[name, 'a'], [name, 'b']]));
            expect((await request.build()).url.searchParams.getAll(name)).toEqual(['a', 'b']);
            const record = await api.get('/').query({ [name]: 'record' }).build();
            expect(record.url.searchParams.getAll(name)).toEqual(['record']);
        },
    );

    it('preserves headers whose names coincide with prototype properties', async () => {
        const fetchImpl = vi.fn<typeof fetch>(async () => Promise.resolve(new Response('ok')));
        const request = avirx('https://example.com', { fetch: fetchImpl })
            .header('__proto__', 'value').get('/').header('constructor', 'another');
        const built = await request.build();
        expect(Object.hasOwn(built.headers, '__proto__')).toBe(true);
        expect(built.headers.__proto__).toBe('value');
        expect(built.redactedHeaders.__proto__).toBe('value');
        expect(built.headers.constructor).toBe('another');
        await request.send();
        expect(new Headers(fetchImpl.mock.calls[0]?.[1]?.headers).get('__proto__')).toBe('value');
    });

    it('redacts configured auth query names after overrides and bypasses cache', async () => {
        const fetchImpl = vi.fn<typeof fetch>(async () => Promise.resolve(Response.json({ ok: true })));
        const api = avirx('https://example.com', { fetch: fetchImpl })
            .cache({ ttl: '1s' }).auth.query('api_key', () => 'client-secret');
        const request = api.get('/?api_key=route-secret')
            .query({ api_key: ['override-secret', 'other-secret'] });
        const preview = await request.preview();
        expect(preview.url).not.toContain('secret');
        expect(new URL(preview.url).searchParams.getAll('api_key')).toEqual(['[redacted]']);
        expect(preview.curl).not.toContain('secret');
        expect((await request.build()).authenticated).toBe(true);
        expect(await request.curl({ redacted: false })).toContain('override-secret');
        await request.json();
        await request.json();
        expect(fetchImpl).toHaveBeenCalledTimes(2);
        expect(api.state.cache?.size()).toBe(0);
    });
});
