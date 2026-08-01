import { describe, expect, it } from 'vitest';
import { avirx } from 'avirx';

describe('HTTP method builders', () => {
    it('serializes plain object bodies to JSON and sets content type when absent', () => {
        const builder = avirx('https://api.example.com').post('/events').body({ ok: true });

        expect(builder.state.body).toBe('{"ok":true}');
        expect(builder.state.bodyMetadata).toMatchObject({
            contentLength: 11,
            contentType: 'application/json',
            kind: 'json',
        });
        expect(builder.state.headers).toEqual({ 'content-type': 'application/json' });
    });

    it('respects explicit request content type for JSON bodies', () => {
        const builder = avirx('https://api.example.com')
            .post('/events')
            .header('Content-Type', 'application/vnd.api+json')
            .body({ ok: true });

        expect(builder.state.body).toBe('{"ok":true}');
        expect(builder.state.headers).toEqual({ 'content-type': 'application/vnd.api+json' });
    });

    it('respects explicit client content type for JSON bodies', () => {
        const builder = avirx('https://api.example.com')
            .header('Content-Type', 'application/problem+json')
            .post('/events')
            .body({ ok: true });

        expect(builder.state.body).toBe('{"ok":true}');
        expect(builder.clientState.headers).toEqual({ 'content-type': 'application/problem+json' });
        expect(builder.state.headers).toEqual({});
    });

    it('omits body(undefined)', () => {
        const builder = avirx('https://api.example.com').post('/events').body(undefined);

        expect('body' in builder.state).toBe(false);
        expect(builder.state.bodyMetadata).toEqual({ kind: 'none' });
        expect(builder.state.headers).toEqual({});
    });

    it('clears a previous JSON body with body(undefined)', async () => {
        const builder = avirx('https://api.example.com')
            .post('/events')
            .body({ ok: true })
            .body(undefined);

        expect('body' in builder.state).toBe(false);
        expect(builder.state.bodyMetadata).toEqual({ kind: 'none' });

        const built = await builder.build();

        expect('body' in built).toBe(false);
        expect(built.bodyMetadata).toEqual({ kind: 'none' });
    });

    it('clears a previous multipart body with body(undefined)', async () => {
        const builder = avirx('https://api.example.com')
            .post('/avatars')
            .multipart()
            .field('userId', 'usr_123')
            .body(undefined);

        expect('body' in builder.state).toBe(false);
        expect(builder.state.bodyMetadata).toEqual({ kind: 'none' });

        const built = await builder.build();

        expect('body' in built).toBe(false);
        expect(built.bodyMetadata).toEqual({ kind: 'none' });
    });
});
