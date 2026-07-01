import { describe, expect, it } from 'vitest';

import { parseContentDispositionFilename, parseContentLength } from '../../src/download.js';
import { createAbortScope, createRequestFailureMessage } from '../../src/internals/abort.js';
import { classifyBody, shouldEncodeJson } from '../../src/internals/body.js';
import { cloneFormData, prepareBodyState } from '../../src/internals/body-state.js';
import { normalizeDurationMs } from '../../src/internals/duration.js';
import { createReadonlySet, freezeRecord } from '../../src/internals/freeze.js';
import { normalizeHeaders } from '../../src/internals/headers.js';
import { isJsonContentType } from '../../src/internals/json.js';
import { createRequestState } from '../../src/internals/model.js';
import { appendQuery, normalizeQuery, serializeQuery } from '../../src/internals/query.js';
import { isSensitiveHeader, redactHeaders } from '../../src/internals/redact.js';
import { calculateRetryDelayMs, normalizeRetry } from '../../src/internals/retry.js';
import { isExpectedStatus, normalizeExpectedStatuses } from '../../src/internals/status.js';
import { extractPathParamNames, interpolatePath, joinUrl } from '../../src/internals/url.js';

describe('duration utilities', () => {
    it('normalizes milliseconds and seconds', () => {
        expect(normalizeDurationMs(500)).toBe(500);
        expect(normalizeDurationMs('500ms')).toBe(500);
        expect(normalizeDurationMs('5s')).toBe(5000);
        expect(normalizeDurationMs(2_147_483_647)).toBe(2_147_483_647);
    });

    it('rejects invalid durations', () => {
        expect(() => normalizeDurationMs(-1)).toThrow(TypeError);
        expect(() => normalizeDurationMs(2_147_483_648)).toThrow(TypeError);
        expect(() => normalizeDurationMs('2147483.648s')).toThrow(TypeError);
        expect(() => normalizeDurationMs('ms' as '1ms')).toThrow(TypeError);
        expect(() => normalizeDurationMs('soon' as '1s')).toThrow(TypeError);
    });
});

describe('header utilities', () => {
    it('normalizes header names to lowercase and freezes the result', () => {
        const headers = normalizeHeaders({ Accept: 'application/json', 'X-Client': 'avirx' });

        expect(headers).toEqual({ accept: 'application/json', 'x-client': 'avirx' });
        expect(Object.isFrozen(headers)).toBe(true);
    });

    it('rejects undefined header values', () => {
        expect(() => normalizeHeaders({ Accept: undefined } as never)).toThrow(TypeError);
    });

    it('redacts sensitive headers', () => {
        const headers = redactHeaders({
            Authorization: 'Bearer token',
            Cookie: 'session=abc',
            'X-Api-Key': 'secret',
            'X-Client': 'avirx',
        });

        expect(headers).toEqual({
            authorization: '[redacted]',
            cookie: '[redacted]',
            'x-api-key': '[redacted]',
            'x-client': 'avirx',
        });
        expect(isSensitiveHeader('service-api-key')).toBe(true);
    });
});

describe('URL utilities', () => {
    it('joins base URL paths with relative routes', () => {
        expect(joinUrl('https://api.example.com/v1', '/users').href).toBe(
            'https://api.example.com/v1/users',
        );
        expect(joinUrl('https://api.example.com/v1/', 'users/123').href).toBe(
            'https://api.example.com/v1/users/123',
        );
    });

    it('preserves route query strings and hashes', () => {
        expect(joinUrl('https://api.example.com/v1', '/users?active=true#top').href).toBe(
            'https://api.example.com/v1/users?active=true#top',
        );
    });

    it('lets absolute routes replace the base URL', () => {
        expect(joinUrl('https://api.example.com/v1', 'https://other.example.test/users').href).toBe(
            'https://other.example.test/users',
        );
    });

    it('preserves non-HTTP absolute routes while keeping protocol-relative routes local', () => {
        expect(joinUrl('https://api.example.com/v1', 'custom+scheme:users').href).toBe(
            'custom+scheme:users',
        );
        expect(joinUrl('https://api.example.com/v1', '//other.example.test/users').href).toBe(
            'https://api.example.com/v1/users',
        );
    });

    it('extracts path param names once', () => {
        expect(extractPathParamNames('/users/{id}/teams/{id}/{teamId}')).toEqual(['id', 'teamId']);
    });

    it('interpolates and URI-encodes path params', () => {
        expect(interpolatePath('/users/{id}/files/{file}', { file: 'a/b', id: 'usr 123' })).toBe(
            '/users/usr%20123/files/a%2Fb',
        );
    });

    it('uses repeated path params consistently', () => {
        expect(interpolatePath('/compare/{id}/{id}', { id: 'same value' })).toBe(
            '/compare/same%20value/same%20value',
        );
    });

    it('rejects missing and extra path params', () => {
        expect(() => interpolatePath('/users/{id}', {})).toThrow('Missing path param "id".');
        expect(() => interpolatePath('/users/{id}', { extra: 'nope', id: 'usr_123' })).toThrow(
            'Unexpected path params: extra.',
        );
    });

    it('can join interpolated paths to base URLs', () => {
        const path = interpolatePath('/users/{id}', { id: 'usr 123' });

        expect(joinUrl('https://api.example.com/v1', path).href).toBe(
            'https://api.example.com/v1/users/usr%20123',
        );
    });
});

describe('query utilities', () => {
    it('serializes arrays as repeated params and omits nullish values', () => {
        const params = serializeQuery({
            active: true,
            empty: null,
            limit: 10,
            missing: undefined,
            tag: ['a', 'b'],
        });

        expect(params.toString()).toBe('active=true&limit=10&tag=a&tag=b');
    });

    it('normalizes URLSearchParams with repeated keys', () => {
        const params = new URLSearchParams('tag=a&tag=b&limit=10');

        expect(normalizeQuery(params)).toEqual({ limit: '10', tag: ['a', 'b'] });
    });

    it('preserves existing query params when appending new values', () => {
        const url = appendQuery(new URL('https://api.example.com/events?existing=1'), {
            tag: ['a', 'b'],
        });

        expect(url.href).toBe('https://api.example.com/events?existing=1&tag=a&tag=b');
    });

    it('appends query params before URL fragments', () => {
        const url = appendQuery(new URL('https://api.example.com/events#section'), {
            tag: 'paperback',
        });

        expect(url.href).toBe('https://api.example.com/events?tag=paperback#section');
    });

    it('omits empty query arrays', () => {
        expect(serializeQuery({ tag: [] }).toString()).toBe('');
    });
});

describe('status utilities', () => {
    it('normalizes expected statuses', () => {
        expect([...normalizeExpectedStatuses(204)]).toEqual([204]);
        expect([...normalizeExpectedStatuses([200, 201])]).toEqual([200, 201]);
    });

    it('uses 2xx as the default when no statuses are configured', () => {
        const defaults: Set<number> = new Set();

        expect(isExpectedStatus(200, defaults)).toBe(true);
        expect(isExpectedStatus(299, defaults)).toBe(true);
        expect(isExpectedStatus(300, defaults)).toBe(false);
    });

    it('checks explicit expected statuses', () => {
        const expected = normalizeExpectedStatuses([200, 201]);

        expect(isExpectedStatus(200, expected)).toBe(true);
        expect(isExpectedStatus(204, expected)).toBe(false);
    });
});

describe('retry utilities', () => {
    it('normalizes retry inputs with deterministic backoff', () => {
        expect(normalizeRetry(3)).toEqual({
            attempts: 3,
            on: [408, 429, 500, 502, 503, 504],
            safeOnly: true,
        });
        expect(normalizeRetry({ attempts: 2, on: [429, 503] })).toEqual({
            attempts: 2,
            on: [429, 503],
            safeOnly: true,
        });
        expect(Object.isFrozen(normalizeRetry({ attempts: 2, on: [503] }).on)).toBe(true);
        expect(calculateRetryDelayMs(1)).toBe(10);
        expect(calculateRetryDelayMs(2)).toBe(20);
        expect(calculateRetryDelayMs(1, '2')).toBe(2000);
        expect(calculateRetryDelayMs(
            1,
            'Wed, 21 Oct 2015 07:28:02 GMT',
            Date.parse('Wed, 21 Oct 2015 07:28:00 GMT'),
        )).toBe(2000);
        expect(calculateRetryDelayMs(1, 'not-a-date')).toBe(10);
        expect(calculateRetryDelayMs(
            1,
            'Wed, 21 Oct 2015 07:27:59 GMT',
            Date.parse('Wed, 21 Oct 2015 07:28:00 GMT'),
        )).toBe(10);
        expect(calculateRetryDelayMs(1, '999999')).toBe(60_000);
    });

    it('rejects invalid retry attempts', () => {
        expect(() => normalizeRetry(-1)).toThrow(
            'Retry attempts must be a non-negative integer from 0 to 10.',
        );
        expect(() => normalizeRetry(1.5)).toThrow(
            'Retry attempts must be a non-negative integer from 0 to 10.',
        );
        expect(() => normalizeRetry(Number.POSITIVE_INFINITY)).toThrow(
            'Retry attempts must be a non-negative integer from 0 to 10.',
        );
        expect(() => normalizeRetry(11)).toThrow(
            'Retry attempts must be a non-negative integer from 0 to 10.',
        );
    });

    it('rejects invalid retry status lists', () => {
        expect(() => normalizeRetry({ attempts: 1, on: [] })).toThrow(
            'Retry status list cannot be empty.',
        );
        expect(() => normalizeRetry({ attempts: 1, on: [99] })).toThrow(
            'Invalid retry status 99. Expected an integer from 100 to 599.',
        );
        expect(() => normalizeRetry({ attempts: 1, on: [600] })).toThrow(
            'Invalid retry status 600. Expected an integer from 100 to 599.',
        );
        expect(() => normalizeRetry({ attempts: 1, on: [503.5] })).toThrow(
            'Invalid retry status 503.5. Expected an integer from 100 to 599.',
        );
    });
});

describe('JSON utilities', () => {
    it('detects JSON media types', () => {
        expect(isJsonContentType('application/json')).toBe(true);
        expect(isJsonContentType('application/problem+json; charset=utf-8')).toBe(true);
        expect(isJsonContentType('text/plain')).toBe(false);
        expect(isJsonContentType(undefined)).toBe(false);
    });
});

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

describe('body state utilities', () => {
    it('serializes JSON bodies and adds content-type only when absent', () => {
        const state = createRequestState('POST', '/events');

        const prepared = prepareBodyState({}, state, { ok: true });

        expect(prepared).toEqual({
            body: '{"ok":true}',
            bodyMetadata: {
                contentLength: 11,
                contentType: 'application/json',
                kind: 'json',
            },
            headers: {
                'content-type': 'application/json',
            },
        });

        expect(prepareBodyState({ 'content-type': 'text/plain' }, state, { ok: true }).headers).toEqual({});
        expect(prepareBodyState({}, {
            ...state,
            headers: { 'content-type': 'application/custom+json' },
        }, { ok: true }).headers).toEqual({ 'content-type': 'application/custom+json' });
    });

    it('clones replayable mutable body values before storing request state', () => {
        const state = createRequestState('POST', '/events');
        const params = new URLSearchParams({ tag: 'a' });
        const buffer = new ArrayBuffer(2);
        const data = new FormData();
        data.append('name', 'avatar');

        const preparedParams = prepareBodyState({}, state, params);
        const preparedBuffer = prepareBodyState({}, state, buffer);
        const preparedForm = prepareBodyState({}, state, data);
        params.set('tag', 'changed');
        new Uint8Array(buffer)[0] = 255;
        data.append('extra', 'later');

        expect(preparedParams.body).toBeInstanceOf(URLSearchParams);
        expect((preparedParams.body as URLSearchParams).toString()).toBe('tag=a');
        expect(preparedBuffer.body).toBeInstanceOf(ArrayBuffer);
        expect(new Uint8Array(preparedBuffer.body as ArrayBuffer)[0]).toBe(0);
        expect(preparedForm.body).toBeInstanceOf(FormData);
        expect((preparedForm.body as FormData).getAll('extra')).toEqual([]);
    });

    it('rejects multipart clones from non-FormData body state', () => {
        expect(() => cloneFormData('not-form')).toThrow(
            'Expected multipart body state to contain FormData.',
        );
    });
});

describe('download utilities', () => {
    it('parses safe content length headers', () => {
        expect(parseContentLength('42')).toBe(42);
        expect(parseContentLength('0042')).toBe(42);
        expect(parseContentLength('-1')).toBeUndefined();
        expect(parseContentLength('1.5')).toBeUndefined();
        expect(parseContentLength(String(Number.MAX_SAFE_INTEGER + 1))).toBeUndefined();
    });

    it('parses content-disposition filenames with quoted delimiters and utf-8 preference', () => {
        expect(parseContentDispositionFilename('attachment; filename="report; q1.csv"')).toBe(
            'report; q1.csv',
        );
        expect(parseContentDispositionFilename(
            'attachment; filename=plain.txt; filename*=UTF-8\'\'caf%C3%A9.txt',
        )).toBe('café.txt');
        expect(parseContentDispositionFilename('attachment; filename*=ISO-8859-1\'\'caf%E9.txt')).toBeUndefined();
    });
});

describe('abort utilities', () => {
    it('composes abort signals while preserving the abort reason', () => {
        const first = new AbortController();
        const second = new AbortController();
        const reason = new Error('stop');
        const scope = createAbortScope([first.signal, second.signal]);

        second.abort(reason);

        expect(scope.signal?.aborted).toBe(true);
        expect(scope.signal?.reason).toBe(reason);
        scope.cancel();
    });

    it('names timeout, external abort, and generic request failures distinctly', () => {
        const timeout = new AbortController();
        const external = new AbortController();

        expect(createRequestFailureMessage(timeout.signal, external.signal)).toBe('Request failed.');

        external.abort();
        expect(createRequestFailureMessage(timeout.signal, external.signal)).toBe('Request aborted.');

        timeout.abort();
        expect(createRequestFailureMessage(timeout.signal, external.signal)).toBe('Request timed out.');
    });
});

describe('freeze utilities', () => {
    it('copies and freezes records', () => {
        const source = { accept: 'application/json' };
        const frozen = freezeRecord(source);
        source.accept = 'text/plain';

        expect(frozen).toEqual({ accept: 'application/json' });
        expect(Object.isFrozen(frozen)).toBe(true);
    });

    it('creates readonly set snapshots with standard set operations', () => {
        const values = createReadonlySet(['a', 'b', 'c']);
        const other = new Set(['b', 'c', 'd']);

        expect(Object.isFrozen(values)).toBe(true);
        expect(values.size).toBe(3);
        expect(values.has('a')).toBe(true);
        expect([...values]).toEqual(['a', 'b', 'c']);
        expect([...values.keys()]).toEqual(['a', 'b', 'c']);
        expect([...values.values()]).toEqual(['a', 'b', 'c']);
        expect([...values.entries()]).toEqual([
            ['a', 'a'],
            ['b', 'b'],
            ['c', 'c'],
        ]);
        expect(Array.from(values.difference(other))).toEqual(['a']);
        expect(Array.from(values.intersection(other))).toEqual(['b', 'c']);
        expect(Array.from(values.symmetricDifference(other))).toEqual(['a', 'd']);
        expect(Array.from(values.union(other))).toEqual(['a', 'b', 'c', 'd']);
        expect(values.isDisjointFrom(new Set(['z']))).toBe(true);
        expect(values.isDisjointFrom(new Set(['z', 'a']))).toBe(false);
        expect(createReadonlySet(['a', 'b']).isSubsetOf(values)).toBe(true);
        expect(values.isSubsetOf(new Set(['a', 'b']))).toBe(false);
        expect(values.isSupersetOf(new Set(['a', 'b']))).toBe(true);
        expect(values.isSupersetOf(new Set(['a', 'z']))).toBe(false);

        const seen: string[] = [];
        values.forEach((value, key, set) => {
            expect(value).toBe(key);
            expect(set).toBe(values);
            seen.push(value);
        });
        expect(seen).toEqual(['a', 'b', 'c']);
    });
});
