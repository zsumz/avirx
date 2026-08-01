import { describe, expect, it } from 'vitest';
import { createReadonlySet, freezeRecord } from '../../../src/state/freeze.js';

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
