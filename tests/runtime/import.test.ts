import { describe, expect, it } from 'vitest';

import {
    AvirxError,
    avirx,
    endpoint,
    isAvirxError,
    type AvirxBuiltRequest,
    type AvirxCacheInput,
    type AvirxRateLimitInput,
} from 'avirx';

const request: AvirxBuiltRequest = {
    authenticated: false,
    bodyMetadata: { kind: 'none' },
    headers: {},
    method: 'GET',
    redactedHeaders: {},
    redactedUrl: new URL('https://api.example.com'),
    sensitiveHeaders: [],
    url: new URL('https://api.example.com'),
};

describe('public package surface', () => {
    it('exports the MVP entry points', () => {
        expect(typeof avirx).toBe('function');
        expect(typeof avirx('https://api.example.com').contract).toBe('function');
        expect(typeof endpoint).toBe('object');
        expect(typeof endpoint.get).toBe('function');
        expect(typeof AvirxError).toBe('function');
        expect(isAvirxError(new AvirxError('boom', { request }))).toBe(true);
        const cache: AvirxCacheInput = { ttl: '30s', vary: ['accept'] };
        expect(cache.ttl).toBe('30s');
        const rateLimit: AvirxRateLimitInput = { per: '1s', requests: 60 };
        expect(rateLimit.requests).toBe(60);
    });
});
