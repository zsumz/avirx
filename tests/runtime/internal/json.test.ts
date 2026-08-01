import { describe, expect, it } from 'vitest';
import { isJsonContentType } from '../../../src/internals/json.js';

describe('JSON utilities', () => {
    it('detects JSON media types', () => {
        expect(isJsonContentType('application/json')).toBe(true);
        expect(isJsonContentType('application/problem+json; charset=utf-8')).toBe(true);
        expect(isJsonContentType('text/plain')).toBe(false);
        expect(isJsonContentType(undefined)).toBe(false);
    });
});
