#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { browserRuntimeSource } from './smoke/browser-runtime-source.mts';
import { assertNoNodeRuntimeImports } from './smoke/browser-runtime-scan.mts';
import { runCommand } from './smoke/command.mts';
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

        await writeFile(
            join(packageDirectory, 'browser-runtime.mjs'),
            browserRuntimeSource,
            'utf8',
        );
        log('Running browser Web API compatibility fixture');
        runCommand(process.execPath, ['browser-runtime.mjs'], { cwd: packageDirectory });
    },
);

log('Browser compatibility smoke test passed');
