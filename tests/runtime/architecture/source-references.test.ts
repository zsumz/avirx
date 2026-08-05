import { describe, expect, it } from 'vitest';
import { collectModuleSpecifiers } from '../../../scripts/architecture/module/source-references.mts';

type SyntaxCase = Readonly<{
    expected: readonly string[];
    label: string;
    source: string;
}>;

const syntaxCases: readonly SyntaxCase[] = [
    {
        expected: [],
        label: 'whole-clause type imports',
        source: 'import type { Client } from \'./client.js\';',
    },
    {
        expected: [],
        label: 'inline type-only imports',
        source: 'import { type Client } from \'./client.js\';',
    },
    {
        expected: ['./client.js'],
        label: 'mixed default and type imports',
        source: 'import Client, { type ClientOptions } from \'./client.js\';',
    },
    {
        expected: ['./client.js'],
        label: 'namespace imports',
        source: 'import * as Client from \'./client.js\';',
    },
    {
        expected: ['./register.js'],
        label: 'empty imports',
        source: 'import {} from \'./register.js\';',
    },
    {
        expected: ['./register.js'],
        label: 'side-effect imports',
        source: 'import \'./register.js\';',
    },
    {
        expected: [],
        label: 'whole-clause type exports',
        source: 'export type { Client } from \'./client.js\';',
    },
    {
        expected: [],
        label: 'inline type-only exports',
        source: 'export { type Client } from \'./client.js\';',
    },
    {
        expected: ['./client.js'],
        label: 'mixed value and type exports',
        source: 'export { Client, type ClientOptions } from \'./client.js\';',
    },
    {
        expected: ['./register.js'],
        label: 'empty exports',
        source: 'export {} from \'./register.js\';',
    },
    {
        expected: ['./client.js'],
        label: 'export-star declarations',
        source: 'export * from \'./client.js\';',
    },
    {
        expected: ['./client.js'],
        label: 'namespace exports',
        source: 'export * as Client from \'./client.js\';',
    },
    {
        expected: ['./client.js'],
        label: 'dynamic imports',
        source: 'const client = import(\'./client.js\');',
    },
];

describe('runtime module reference classification', () => {
    it.each(syntaxCases)('classifies $label', ({ expected, source }) => {
        expect(collectModuleSpecifiers('fixture.ts', source)).toEqual(expected);
    });
});
