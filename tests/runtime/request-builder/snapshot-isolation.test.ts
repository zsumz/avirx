import { describe, expect, it, vi } from 'vitest';
import { avirx } from 'avirx';

describe('request snapshot isolation', () => {
    it.each(['state', 'build', 'preview'] as const)(
        'returns isolated URLSearchParams bodies through %s',
        async (exposure) => {
            const fetchImpl = vi.fn<typeof fetch>(async () => Promise.resolve(new Response('ok')));
            const original = avirx('https://example.com', { fetch: fetchImpl })
                .post('/').body(new URLSearchParams({ value: 'original' }));
            const derived = original.header('x-derived', 'yes');
            const snapshot = exposure === 'state' ? derived.state : await derived[exposure]();
            const exposed = snapshot.body;
            if (!(exposed instanceof URLSearchParams)) throw new TypeError('Expected form body.');
            exposed.set('value', 'changed');
            const untouched = snapshot.body;
            expect(untouched instanceof URLSearchParams && untouched.toString()).toBe('value=original');
            await original.text();
            await derived.text();
            expect(fetchImpl.mock.calls.map(([, init]) =>
                init?.body instanceof URLSearchParams ? init.body.toString() : undefined))
                .toEqual(['value=original', 'value=original']);
        },
    );

    it('isolates FormData and ArrayBuffer inspection from every request fork', async () => {
        const api = avirx('https://example.com');
        const form = new FormData();
        form.set('name', 'original');
        const original = api.post('/').body(form);
        const built = await original.header('x-fork', 'yes').build();
        if (!(built.body instanceof FormData)) throw new TypeError('Expected multipart body.');
        built.body.set('name', 'changed');
        expect((original.state.body as FormData).get('name')).toBe('original');
        expect(built.body.get('name')).toBe('original');
        const binary = api.post('/').body(new Uint8Array([1, 2]).buffer);
        const preview = await binary.preview();
        new Uint8Array(preview.body as ArrayBuffer)[0] = 9;
        expect([...new Uint8Array(binary.state.body as ArrayBuffer)]).toEqual([1, 2]);
        expect([...new Uint8Array(preview.body as ArrayBuffer)]).toEqual([1, 2]);
    });

    it('freezes query arrays while preserving the original request and forks', async () => {
        const original = avirx('https://example.com').get('/').query({ tag: ['a'] });
        const derived = original.header('x-fork', 'yes');
        expect(() => (derived.state.query.tag as string[]).push('b')).toThrow(TypeError);
        expect((await original.build()).url.searchParams.getAll('tag')).toEqual(['a']);
        expect((await derived.build()).url.searchParams.getAll('tag')).toEqual(['a']);
    });
});
