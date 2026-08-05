#!/usr/bin/env node
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { startBrowserFixtureServer } from './smoke/browser-fixture-server.mts';
import { assertNoNodeRuntimeImports } from './smoke/browser-runtime-scan.mts';
import { withPackedFixture } from './smoke/fixture.mts';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const log = (message: string): void => {
    console.log(`[browser-smoke] ${message}`);
};

await withPackedFixture(
    { log, prefix: 'avirx-browser-smoke-', root },
    async ({ packageDirectory }) => {
        log('Scanning packed dist for Node runtime imports');
        await assertNoNodeRuntimeImports(join(packageDirectory, 'node_modules/avirx/dist'));

        const server = await startBrowserFixtureServer(packageDirectory);
        try {
            const browser = await chromium.launch();
            try {
                log('Running packed artifact in Chromium');
                const page = await browser.newPage();
                await page.goto(server.url);
                await page.waitForFunction(() =>
                    document.body.dataset.smokeStatus === 'passed'
                    || document.body.dataset.smokeStatus === 'failed');
                const result = page.locator('body');
                const status = await result.getAttribute('data-smoke-status');
                if (status !== 'passed') {
                    const message = await result.getAttribute('data-smoke-message');
                    throw new Error(`Chromium fixture failed: ${message ?? 'unknown browser error'}`);
                }
            } finally {
                await browser.close();
            }
        } finally {
            await server.close();
        }
    },
);

log('Browser compatibility smoke test passed');
