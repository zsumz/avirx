import { describe, expect, it } from 'vitest';
import { parseContentDispositionFilename } from '../../../src/response/content-disposition.js';
import { parseContentLength } from '../../../src/response/content-length.js';

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
