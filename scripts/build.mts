#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
await rm(join(root, 'dist'), { force: true, recursive: true });

const result = spawnSync(
    process.execPath,
    [join(root, 'node_modules/typescript/bin/tsc'), '-p', 'tsconfig.build.json'],
    { cwd: root, stdio: 'inherit' },
);

process.exit(result.status ?? 1);
