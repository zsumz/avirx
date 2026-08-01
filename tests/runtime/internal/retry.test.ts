import { describe, expect, it } from 'vitest';
import { calculateRetryDelayMs, normalizeRetry } from '../../../src/policy/retry/retry.js';

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
