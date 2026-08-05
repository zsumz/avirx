#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
await rm(join(root, 'dist'), { force: true, recursive: true });

const result = spawnSync(
    process.execPath,
    [join(root, 'node_modules/typescript/bin/tsc'), '-p', 'tsconfig.build.json'],
    { cwd: root, stdio: 'inherit' },
);

if (result.status !== 0) {
    process.exit(result.status ?? 1);
}

await build({
    bundle: true,
    entryPoints: [join(root, 'src/index.ts')],
    format: 'esm',
    legalComments: 'none',
    logLevel: 'warning',
    minifySyntax: true,
    outfile: join(root, 'dist/index.js'),
    platform: 'browser',
    target: 'es2022',
    treeShaking: true,
});
