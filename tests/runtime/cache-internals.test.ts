import { describe, expect, it } from 'vitest';

import { createCacheKey, hasSensitiveHeaders } from '../../src/internals/cache-keys.js';
import { isCachedResponse } from '../../src/internals/cache-response.js';
import { createCacheStore } from '../../src/internals/cache-store.js';
import type { AvirxBuiltRequest, AvirxResponse } from '../../src/types.js';

describe('cache internals', () => {
    it('keys responses by URL and configured vary headers', () => {
        const jsonRequest = createRequest({ accept: 'application/json' });
        const textRequest = createRequest({ accept: 'text/plain' });

        expect(createCacheKey(jsonRequest, ['accept'])).not.toBe(createCacheKey(textRequest, ['accept']));
        expect(createCacheKey(jsonRequest, ['x-missing'])).toBe(createCacheKey(textRequest, ['x-missing']));
    });

    it('detects sensitive headers before cache eligibility', () => {
        expect(hasSensitiveHeaders({ authorization: 'Bearer token' })).toBe(true);
        expect(hasSensitiveHeaders({ accept: 'application/json' })).toBe(false);
    });

    it('stores cloned responses and marks cache hits', async () => {
        const request = createRequest({ accept: 'application/json' });
        const store = createCacheStore({ ttlMs: 100, vary: ['accept'] });

        await store.set(request, createResponse(request, 'ok'));

        const cached = store.get(request);
        expect(cached).toBeDefined();
        if (!cached) {
            throw new Error('Expected cached response.');
        }

        expect(cached).not.toBe(createResponse(request, 'ok'));
        expect(isCachedResponse(cached)).toBe(true);
        await expect(cached.native.text()).resolves.toBe('ok');
        expect(store.size()).toBe(1);
    });

    it('does not store responses larger than maxBytes after buffering', async () => {
        const request = createRequest({ accept: 'application/json' });
        const store = createCacheStore({ maxBytes: 1, ttlMs: 100, vary: ['accept'] });

        await store.set(request, createResponse(request, 'ok'));

        expect(store.get(request)).toBeUndefined();
        expect(store.size()).toBe(0);
    });
});

function createRequest(headers: AvirxBuiltRequest['headers']): AvirxBuiltRequest {
    const url = new URL('https://api.example.com/users');
    return {
        bodyMetadata: { kind: 'none' },
        headers,
        method: 'GET',
        redactedHeaders: headers,
        redactedUrl: url,
        sensitiveHeaders: [],
        url,
    };
}

function createResponse(request: AvirxBuiltRequest, body: string): AvirxResponse {
    return {
        headers: {
            'content-length': String(body.length),
            'content-type': 'text/plain',
        },
        native: new Response(body, { status: 200, statusText: 'OK' }),
        ok: true,
        request,
        status: 200,
        statusText: 'OK',
        timing: {},
        url: request.url.href,
    };
}
