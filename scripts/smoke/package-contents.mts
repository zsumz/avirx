import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { assertCondition } from './assertion.mts';
import type { PackedFile } from './pack-metadata.mts';

const requiredPackedFiles = [
    'package.json',
    'README.md',
    'LICENSE',
    'avirx-logo.svg',
    'dist/index.js',
    'dist/index.d.ts',
    'dist/client/client.js',
    'dist/request/create-request-builder.js',
    'dist/contract/create-contract-client.js',
    'dist/contract/endpoint.js',
];

export async function assertPackedPackage(
    packageDirectory: string,
    files: readonly PackedFile[],
): Promise<void> {
    const packedPaths = new Set(files.map((file) => file.path));
    for (const file of files) {
        assertCondition(!file.path.endsWith('.map'), `Packed package includes source map ${file.path}.`);
    }
    for (const path of requiredPackedFiles) {
        assertCondition(packedPaths.has(path), `Packed package is missing ${path}.`);
    }
    for (const path of packedPaths) {
        if (path.endsWith('.js') || path.endsWith('.d.ts')) {
            const source = await readFile(join(packageDirectory, 'node_modules/avirx', path), 'utf8');
            assertCondition(
                !source.includes('sourceMappingURL='),
                `Packed package references a source map from ${path}.`,
            );
        }
    }
}

export function assertInstalledPackage(packageDirectory: string): void {
    for (const path of [
        'node_modules/avirx/package.json',
        'node_modules/avirx/LICENSE',
        'node_modules/avirx/dist/index.js',
        'node_modules/avirx/dist/index.d.ts',
    ]) {
        assertCondition(existsSync(join(packageDirectory, path)), `Installed package is missing ${path}.`);
    }
}
