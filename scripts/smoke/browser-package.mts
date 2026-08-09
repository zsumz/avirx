import { join } from 'node:path';
import { chromium } from 'playwright';
import { startBrowserFixtureServer } from './browser-fixture-server.mts';
import { assertNoNodeRuntimeImports } from './browser-runtime-scan.mts';

export async function verifyBrowserPackage(
    packageDirectory: string,
    log: (message: string) => void,
): Promise<void> {
    log('Scanning installed dist for Node runtime imports');
    await assertNoNodeRuntimeImports(join(packageDirectory, 'node_modules/avirx/dist'));

    const server = await startBrowserFixtureServer(packageDirectory);
    try {
        const browser = await chromium.launch();
        try {
            log('Running installed artifact in Chromium');
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
}
