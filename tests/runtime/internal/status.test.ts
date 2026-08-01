import { describe, expect, it } from 'vitest';
import { isExpectedStatus, normalizeExpectedStatuses } from '../../../src/transport/status.js';

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
