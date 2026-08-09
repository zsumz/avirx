#!/usr/bin/env node
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyBrowserPackage } from './smoke/browser-package.mts';
import { withPackedFixture } from './smoke/fixture.mts';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const log = (message: string): void => {
    console.log(`[browser-smoke] ${message}`);
};

await withPackedFixture(
    { log, prefix: 'avirx-browser-smoke-', root },
    async ({ packageDirectory }) => verifyBrowserPackage(packageDirectory, log),
);

log('Browser compatibility smoke test passed');
