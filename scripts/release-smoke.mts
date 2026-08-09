#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertCondition } from './smoke/assertion.mts';
import { verifyBrowserPackage } from './smoke/browser-package.mts';
import { withTarballFixture } from './smoke/fixture.mts';
import { verifyNodePackage } from './smoke/node-package.mts';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const tarballValue = process.env.SALLYPORT_TARBALL;
assertCondition(tarballValue !== undefined, 'SALLYPORT_TARBALL must identify the sealed candidate.');
const tarball = resolve(tarballValue);
const expectedPackage = requiredEnvironment('SALLYPORT_PACKAGE');
const expectedVersion = requiredEnvironment('SALLYPORT_VERSION');
requiredEnvironment('SALLYPORT_DIST_TAG');
const log = (message: string): void => {
    console.log(`[release-smoke] ${message}`);
};

await withTarballFixture(
    { log, prefix: 'avirx-release-smoke-', root, tarball },
    async ({ files, packageDirectory }) => {
        await assertCandidateIdentity(packageDirectory);
        await verifyNodePackage({ files, log, packageDirectory, root });
        await verifyBrowserPackage(packageDirectory, log);
    },
);

log('Exact candidate smoke test passed');

function requiredEnvironment(name: string): string {
    const value = process.env[name];
    assertCondition(value !== undefined && value.length > 0, `${name} must be set by Sallyport.`);
    return value;
}

async function assertCandidateIdentity(packageDirectory: string): Promise<void> {
    const source = await readFile(
        join(packageDirectory, 'node_modules/avirx/package.json'),
        'utf8',
    );
    const manifest: unknown = JSON.parse(source);
    assertCondition(isRecord(manifest), 'Installed candidate manifest must be an object.');
    assertCondition(manifest.name === expectedPackage, 'Installed candidate package name changed.');
    assertCondition(manifest.version === expectedVersion, 'Installed candidate package version changed.');
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
