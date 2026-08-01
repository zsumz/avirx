import { describe, expect, it } from 'vitest';
import { avirx } from 'avirx';

describe('HTTP method builders', () => {
    it('passes through non-JSON body values safely', () => {
        const builder = avirx('https://api.example.com').post('/events').body('hello');

        expect(builder.state.body).toBe('hello');
        expect(builder.state.bodyMetadata).toMatchObject({ contentLength: 5, kind: 'text' });
        expect(builder.state.headers).toEqual({});
    });

    it('snapshots URLSearchParams body values', () => {
        const params = new URLSearchParams({ tag: 'a' });
        const builder = avirx('https://api.example.com').post('/events').body(params);

        params.append('tag', 'b');

        expect(builder.state.body).toBeInstanceOf(URLSearchParams);
        expect(builder.state.body).not.toBe(params);
        expect((builder.state.body as URLSearchParams).getAll('tag')).toEqual(['a']);
        expect(builder.state.bodyMetadata).toMatchObject({ kind: 'url-search-params' });
    });

    it('snapshots ArrayBuffer body values', () => {
        const buffer = new Uint8Array([1, 2, 3]).buffer;
        const builder = avirx('https://api.example.com').post('/events').body(buffer);

        new Uint8Array(buffer)[0] = 9;

        expect(builder.state.body).toBeInstanceOf(ArrayBuffer);
        expect(builder.state.body).not.toBe(buffer);
        expect([...new Uint8Array(builder.state.body as ArrayBuffer)]).toEqual([1, 2, 3]);
        expect(builder.state.bodyMetadata).toMatchObject({ contentLength: 3, kind: 'binary' });
    });

    it('snapshots FormData body values', () => {
        const form = new FormData();
        form.append('name', 'original');

        const builder = avirx('https://api.example.com').post('/events').body(form);
        form.append('name', 'changed');

        expect(builder.state.body).toBeInstanceOf(FormData);
        expect(builder.state.body).not.toBe(form);
        expect((builder.state.body as FormData).getAll('name')).toEqual(['original']);
        expect(builder.state.bodyMetadata).toEqual({ kind: 'form' });
    });

    it('preserves null bodies as explicit empty bodies', () => {
        const builder = avirx('https://api.example.com').post('/events').body(null);

        expect('body' in builder.state).toBe(true);
        expect(builder.state.body).toBeNull();
        expect(builder.state.bodyMetadata).toEqual({ kind: 'none' });
        expect(builder.state.headers).toEqual({});
    });
});
