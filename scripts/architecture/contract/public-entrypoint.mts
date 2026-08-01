import { readFile } from 'node:fs/promises';
import path from 'node:path';

type PackageContract = Readonly<{
    exports?: unknown;
    types?: unknown;
}>;

export async function inspectPublicEntrypoint(root: string): Promise<string[]> {
    const raw: unknown = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
    if (!isPackageContract(raw)) {
        return ['package.json: expected an object package contract.'];
    }
    const failures: string[] = [];
    if (raw.types !== './dist/index.d.ts') {
        failures.push('package.json: types must point to ./dist/index.d.ts.');
    }
    if (!hasExpectedRootExport(raw.exports)) {
        failures.push('package.json: the root export contract changed unexpectedly.');
    }
    return failures;
}

function isPackageContract(value: unknown): value is PackageContract {
    return typeof value === 'object' && value !== null;
}

function hasExpectedRootExport(value: unknown): boolean {
    if (typeof value !== 'object' || value === null) {
        return false;
    }
    const exports = value as Record<string, unknown>;
    if (Object.keys(exports).length !== 1) {
        return false;
    }
    const root = exports['.'];
    if (typeof root !== 'object' || root === null) {
        return false;
    }
    const rootExport = root as Record<string, unknown>;
    return rootExport.types === './dist/index.d.ts'
        && rootExport.import === './dist/index.js';
}
