import { describe, expect, it } from 'vitest';
import { normalizeHeaders } from '../../../src/internals/headers.js';
import { isSensitiveHeader, redactHeaders } from '../../../src/internals/redact.js';

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
