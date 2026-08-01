import { describe, expect, it } from 'vitest';
import { classifyBody, shouldEncodeJson } from '../../../src/internals/body.js';

describe('body utilities', () => {
    it('classifies empty, text, form, binary, stream, and JSON bodies', () => {
        expect(classifyBody(undefined).kind).toBe('none');
        expect(classifyBody('hello')).toMatchObject({ contentLength: 5, kind: 'text' });
        expect(classifyBody('é')).toMatchObject({ contentLength: 2, kind: 'text' });
        expect(classifyBody(new URLSearchParams({ tag: 'a' })).kind).toBe('url-search-params');
        expect(classifyBody(new FormData()).kind).toBe('form');
        expect(classifyBody(new Blob(['hello'], { type: 'text/plain' }))).toMatchObject({
            contentLength: 5,
            contentType: 'text/plain',
            kind: 'binary',
        });
        expect(classifyBody(new ArrayBuffer(8))).toMatchObject({ contentLength: 8, kind: 'binary' });
        expect(classifyBody(new ReadableStream()).kind).toBe('stream');
        expect(classifyBody({ ok: true })).toMatchObject({
            contentType: 'application/json',
            kind: 'json',
        });
    });

    it('detects whether a body should be JSON encoded', () => {
        expect(shouldEncodeJson({ ok: true })).toBe(true);
        expect(shouldEncodeJson({ ok: true }, 'application/vnd.api+json')).toBe(true);
        expect(shouldEncodeJson({ ok: true }, 'text/plain')).toBe(false);
        expect(shouldEncodeJson('already text')).toBe(false);
    });
});
