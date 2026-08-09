#!/usr/bin/env node
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { withPackedFixture } from './smoke/fixture.mts';
import { verifyNodePackage } from './smoke/node-package.mts';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const log = (message: string): void => {
    console.log(`[package-smoke] ${message}`);
};

await withPackedFixture(
    { log, prefix: 'avirx-package-smoke-', root },
    async ({ files, packageDirectory }) => verifyNodePackage({ files, log, packageDirectory, root }),
);

log('Package smoke test passed');
