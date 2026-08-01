import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assertCondition } from './assertion.mts';
import { runCommand } from './command.mts';

export type PackedFile = Readonly<{ path: string }>;

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

export async function withPackedFixture(
    options: FixtureOptions,
    inspect: (fixture: PackedFixture) => Promise<void>,
): Promise<void> {
    const directory = await mkdtemp(join(tmpdir(), options.prefix));
    const packageDirectory = join(directory, 'fixture');
    const npmEnvironment = {
        ...process.env,
        npm_config_cache: join(directory, 'npm-cache'),
    };

    try {
        options.log('Building package');
        runCommand('npm', ['run', 'build'], { cwd: options.root });

        options.log('Packing package');
        const output = runCommand(
            'npm',
            ['pack', '--pack-destination', directory, '--json'],
            { cwd: options.root, env: npmEnvironment },
        );
        const packed = parsePackedMetadata(output);
        const tarball = join(directory, packed.filename);
        assertCondition(existsSync(tarball), `Expected packed tarball at ${tarball}.`);

        await mkdir(packageDirectory, { recursive: true });
        await writeJsonFile(join(packageDirectory, 'package.json'), {
            dependencies: {},
            private: true,
            type: 'module',
        });

        options.log('Installing packed tarball into fixture');
        runCommand(
            'npm',
            ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--package-lock=false', tarball],
            { cwd: packageDirectory, env: npmEnvironment },
        );
        await inspect({
            directory,
            files: packed.files,
            packageDirectory,
            root: options.root,
        });
    } finally {
        await rm(directory, { force: true, recursive: true });
    }
}

export async function writeJsonFile(path: string, value: unknown): Promise<void> {
    await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function parsePackedMetadata(output: string): { filename: string; files: readonly PackedFile[] } {
    const parsed: unknown = JSON.parse(output);
    assertCondition(Array.isArray(parsed), 'npm pack did not return an array.');
    const [packed] = parsed as Array<{ filename?: unknown; files?: unknown }>;
    assertCondition(packed !== undefined, 'npm pack did not report package metadata.');
    assertCondition(typeof packed.filename === 'string', 'npm pack did not report a tarball filename.');
    assertCondition(Array.isArray(packed.files), 'npm pack did not report packed files.');
    return { filename: packed.filename, files: packed.files as PackedFile[] };
}
