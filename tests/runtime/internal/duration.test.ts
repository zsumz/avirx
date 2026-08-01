import { describe, expect, it } from 'vitest';
import { normalizeDurationMs } from '../../../src/time/duration.js';

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
