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
];

const maximumPackedFiles = 130;
const maximumUnpackedBytes = 175_000;

export type PackageShape = Readonly<{
    fileCount: number;
    runtimeFileCount: number;
    unpackedBytes: number;
}>;

export async function assertPackedPackage(
    packageDirectory: string,
    files: readonly PackedFile[],
): Promise<PackageShape> {
    const packedPaths = new Set(files.map((file) => file.path));
    const unpackedBytes = files.reduce((total, file) => total + file.size, 0);
    assertCondition(
        files.length <= maximumPackedFiles,
        `Packed package has ${String(files.length)} files; expected at most ${String(maximumPackedFiles)}.`,
    );
    assertCondition(
        unpackedBytes <= maximumUnpackedBytes,
        `Packed package is ${String(unpackedBytes)} bytes; expected at most ${String(maximumUnpackedBytes)}.`,
    );
    for (const file of files) {
        assertCondition(!file.path.endsWith('.map'), `Packed package includes source map ${file.path}.`);
    }
    for (const path of requiredPackedFiles) {
        assertCondition(packedPaths.has(path), `Packed package is missing ${path}.`);
    }
    const runtimeFiles = files
        .map((file) => file.path)
        .filter((path) => path.startsWith('dist/') && path.endsWith('.js'));
    assertCondition(
        runtimeFiles.length === 1 && runtimeFiles[0] === 'dist/index.js',
        `Packed runtime must contain only dist/index.js; found ${runtimeFiles.join(', ')}.`,
    );
    for (const path of packedPaths) {
        if (path.endsWith('.js') || path.endsWith('.d.ts')) {
            const source = await readFile(join(packageDirectory, 'node_modules/avirx', path), 'utf8');
            assertCondition(
                !source.includes('sourceMappingURL='),
                `Packed package references a source map from ${path}.`,
            );
        }
    }
    return {
        fileCount: files.length,
        runtimeFileCount: runtimeFiles.length,
        unpackedBytes,
    };
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
