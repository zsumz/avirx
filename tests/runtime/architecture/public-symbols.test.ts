import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { inspectPublicSymbolSource } from '../../../scripts/architecture/contract/public-symbols.mts';

const indexSource = readFileSync(resolve(import.meta.dirname, '../../../src/index.ts'), 'utf8');

describe('public symbol contract', () => {
    it('accepts the exact public value and type surface', () => {
        expect(inspectPublicSymbolSource(indexSource)).toEqual([]);
    });

    it('rejects converting a runtime value to a type-only export', () => {
        const source = indexSource.replace(
            'export { AvirxError, isAvirxError }',
            'export { isAvirxError }\nexport type { AvirxError }',
        );

        expect(inspectPublicSymbolSource(source)).toContain(
            'src/index.ts: missing public value AvirxError.',
        );
    });

    it('rejects export-star expansion', () => {
        const source = `${indexSource}\nexport * from './types.js';\n`;

        expect(inspectPublicSymbolSource(source)).toContain(
            'src/index.ts: export-star declarations are not allowed.',
        );
    });

    it('rejects removing a runtime value', () => {
        const source = indexSource.replace('export { formatCurl } from \'./request/curl.js\';\n', '');

        expect(inspectPublicSymbolSource(source)).toContain(
            'src/index.ts: missing public value formatCurl.',
        );
    });

    it('rejects unexpected type exports', () => {
        const source = `${indexSource}\nexport type { Unexpected } from './types.js';\n`;

        expect(inspectPublicSymbolSource(source)).toContain(
            'src/index.ts: unexpected public type Unexpected.',
        );
    });

    it('rejects default exports', () => {
        const source = `${indexSource}\nexport { avirx as default } from './client/client.js';\n`;

        expect(inspectPublicSymbolSource(source)).toContain(
            'src/index.ts: default exports are not allowed.',
        );
    });
});
