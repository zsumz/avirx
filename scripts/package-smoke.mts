#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCommand } from './smoke/command.mts';
import { withPackedFixture, writeJsonFile } from './smoke/fixture.mts';
import { assertInstalledPackage, assertPackedPackage } from './smoke/package-contents.mts';
import { runtimeSmokeSource } from './smoke/package-runtime-source.mts';
import { typeSmokeSource } from './smoke/package-type-source.mts';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const log = (message: string): void => {
    console.log(`[package-smoke] ${message}`);
};

await withPackedFixture(
    { log, prefix: 'avirx-package-smoke-', root },
    async ({ files, packageDirectory }) => {
        const shape = await assertPackedPackage(packageDirectory, files);
        assertInstalledPackage(packageDirectory);
        log(
            `Verified ${String(shape.fileCount)} files, ${String(shape.unpackedBytes)} bytes, `
            + `${String(shape.runtimeFileCount)} runtime entrypoint`,
        );

        await writeFile(join(packageDirectory, 'runtime.mjs'), runtimeSmokeSource, 'utf8');
        log('Verifying ESM runtime import and request builder behavior');
        runCommand(process.execPath, ['runtime.mjs'], { cwd: packageDirectory });

        await writeFile(join(packageDirectory, 'types.ts'), typeSmokeSource, 'utf8');
        await writeJsonFile(join(packageDirectory, 'tsconfig.json'), {
            compilerOptions: {
                exactOptionalPropertyTypes: true,
                lib: ['ESNext', 'DOM'],
                module: 'NodeNext',
                moduleResolution: 'NodeNext',
                noEmit: true,
                strict: true,
                target: 'ES2022',
                types: [],
            },
            include: ['types.ts'],
        });

        log('Verifying TypeScript types from packed artifact');
        runCommand(
            process.execPath,
            [join(root, 'node_modules/typescript/bin/tsc'), '-p', 'tsconfig.json', '--pretty', 'false'],
            { cwd: packageDirectory },
        );
    },
);

log('Package smoke test passed');
