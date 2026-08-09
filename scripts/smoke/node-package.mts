import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { runCommand } from './command.mts';
import { writeJsonFile } from './fixture.mts';
import { assertInstalledPackage, assertPackedPackage } from './package-contents.mts';
import type { PackedFile } from './pack-metadata.mts';
import { runtimeSmokeSource } from './package-runtime-source.mts';
import { serverSmokeSource } from './package-server-source.mts';
import { typeSmokeSource } from './package-type-source.mts';

type VerificationOptions = Readonly<{
    files: readonly PackedFile[];
    log(message: string): void;
    packageDirectory: string;
    root: string;
}>;

export async function verifyNodePackage(options: VerificationOptions): Promise<void> {
    const shape = await assertPackedPackage(options.packageDirectory, options.files);
    assertInstalledPackage(options.packageDirectory);
    options.log(
        `Verified ${String(shape.fileCount)} files, ${String(shape.unpackedBytes)} bytes, `
        + `${String(shape.runtimeFileCount)} runtime entrypoint`,
    );

    await writeFile(join(options.packageDirectory, 'runtime.mjs'), runtimeSmokeSource, 'utf8');
    options.log('Verifying ESM runtime import and request builder behavior');
    runCommand(process.execPath, ['runtime.mjs'], { cwd: options.packageDirectory });

    await writeFile(join(options.packageDirectory, 'server-runtime.mjs'), serverSmokeSource, 'utf8');
    options.log('Verifying installed package against a real HTTP server');
    runCommand(process.execPath, ['server-runtime.mjs'], { cwd: options.packageDirectory });

    await writeFile(join(options.packageDirectory, 'types.ts'), typeSmokeSource, 'utf8');
    await writeJsonFile(join(options.packageDirectory, 'tsconfig.json'), {
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

    options.log('Verifying TypeScript types from installed artifact');
    runCommand(
        process.execPath,
        [join(options.root, 'node_modules/typescript/bin/tsc'), '-p', 'tsconfig.json', '--pretty', 'false'],
        { cwd: options.packageDirectory },
    );
}
