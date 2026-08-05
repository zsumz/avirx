import { describe, expect, it } from 'vitest';
import { parsePackedMetadata } from '../../../scripts/smoke/pack-metadata.mts';

describe('npm pack metadata', () => {
    const metadata = {
        filename: 'avirx-0.1.0-alpha.1.tgz',
        files: [{ path: 'dist/index.js', size: 1_024 }],
    };

    it('accepts the legacy array response', () => {
        expect(parsePackedMetadata(JSON.stringify([metadata]))).toEqual(metadata);
    });

    it('accepts the npm 12 package-keyed response', () => {
        expect(parsePackedMetadata(JSON.stringify({ avirx: metadata }))).toEqual(metadata);
    });

    it('rejects ambiguous or malformed responses', () => {
        expect(() => parsePackedMetadata(JSON.stringify([]))).toThrow(
            'npm pack did not report exactly one package.',
        );
        expect(() => parsePackedMetadata(JSON.stringify({
            avirx: metadata,
            other: metadata,
        }))).toThrow('npm pack did not report exactly one package.');
        expect(() => parsePackedMetadata(JSON.stringify([{
            filename: metadata.filename,
            files: [{}],
        }]))).toThrow('npm pack reported a file without a path.');
    });
});
