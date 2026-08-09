import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assertCondition } from './assertion.mts';
import { runCommand } from './command.mts';
import { collectInstalledFiles } from './installed-files.mts';
import { parsePackedMetadata } from './pack-metadata.mts';
import type { PackedFile } from './pack-metadata.mts';

export type PackedFixture = Readonly<{
    directory: string;
    files: readonly PackedFile[];
    packageDirectory: string;
    root: string;
}>;

type FixtureOptions = Readonly<{
    log(message: string): void;
    prefix: string;
    root: string;
}>;

type TarballFixtureOptions = FixtureOptions & Readonly<{
    tarball: string;
}>;

export async function withPackedFixture(
    options: FixtureOptions,
    inspect: (fixture: PackedFixture) => Promise<void>,
): Promise<void> {
    const directory = await mkdtemp(join(tmpdir(), options.prefix));
    try {
        options.log('Building package');
        runCommand('npm', ['run', 'build'], { cwd: options.root });

        options.log('Packing package');
        const output = runCommand(
            'npm',
            ['pack', '--ignore-scripts', '--pack-destination', directory, '--json'],
            {
                cwd: options.root,
                env: { ...process.env, npm_config_cache: join(directory, 'npm-cache') },
            },
        );
        const packed = parsePackedMetadata(output);
        const tarball = join(directory, packed.filename);
        assertCondition(existsSync(tarball), `Expected packed tarball at ${tarball}.`);

        await installFixture(options, directory, tarball, packed.files, inspect);
    } finally {
        await rm(directory, { force: true, recursive: true });
    }
}

export async function withTarballFixture(
    options: TarballFixtureOptions,
    inspect: (fixture: PackedFixture) => Promise<void>,
): Promise<void> {
    const directory = await mkdtemp(join(tmpdir(), options.prefix));
    try {
        assertCondition(existsSync(options.tarball), `Expected tarball at ${options.tarball}.`);
        await installFixture(options, directory, options.tarball, undefined, inspect);
    } finally {
        await rm(directory, { force: true, recursive: true });
    }
}

async function installFixture(
    options: FixtureOptions,
    directory: string,
    tarball: string,
    packedFiles: readonly PackedFile[] | undefined,
    inspect: (fixture: PackedFixture) => Promise<void>,
): Promise<void> {
    const packageDirectory = join(directory, 'fixture');
    await mkdir(packageDirectory, { recursive: true });
    await writeJsonFile(join(packageDirectory, 'package.json'), {
        dependencies: {},
        private: true,
        type: 'module',
    });

    options.log('Installing tarball into isolated fixture');
    runCommand(
        'npm',
        ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--package-lock=false', tarball],
        {
            cwd: packageDirectory,
            env: { ...process.env, npm_config_cache: join(directory, 'npm-cache') },
        },
    );
    const installedRoot = join(packageDirectory, 'node_modules/avirx');
    await inspect({
        directory,
        files: packedFiles ?? await collectInstalledFiles(installedRoot),
        packageDirectory,
        root: options.root,
    });
}

export async function writeJsonFile(path: string, value: unknown): Promise<void> {
    await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
