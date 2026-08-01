import { describe, expect, it } from 'vitest';
import { appendQuery, normalizeQuery, serializeQuery } from '../../../src/transport/query.js';

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
