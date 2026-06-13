import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

type PackageJson = Readonly<{
    name?: unknown;
    version?: unknown;
}>;

const REPO_ROOT = new URL('../', import.meta.url);
const ARTIFACT_DIR = new URL('artifacts/source/', REPO_ROOT);

async function main(): Promise<void> {
    await assertCleanWorktree();

    const packageJson = await readPackageJson();
    const packageName = assertText(packageJson.name, 'package name');
    const version = assertText(packageJson.version, 'package version');
    const revision = (await git(['rev-parse', '--short=12', 'HEAD'])).trim();
    const archiveName = `${packageName}-source-v${version}-${revision}.tar.gz`;
    const archivePath = fileURLToPath(new URL(archiveName, ARTIFACT_DIR));
    const checksumPath = `${archivePath}.sha256`;
    const prefix = `${packageName}-source-v${version}-${revision}/`;

    await mkdir(ARTIFACT_DIR, { recursive: true });
    await git([
        'archive',
        '--format=tar.gz',
        `--output=${archivePath}`,
        `--prefix=${prefix}`,
        'HEAD',
    ]);

    const checksum = await sha256File(archivePath);
    await writeFile(checksumPath, `${checksum}  ${archiveName}\n`);

    console.log(`Source archive: ${archivePath}`);
    console.log(`SHA-256: ${checksumPath}`);
}

async function readPackageJson(): Promise<PackageJson> {
    const text = await readFile(new URL('package.json', REPO_ROOT), 'utf8');
    const parsed: unknown = JSON.parse(text);
    if (!isPackageJson(parsed)) {
        throw new TypeError('package.json must contain a JSON object.');
    }

    return parsed;
}

function isPackageJson(value: unknown): value is PackageJson {
    return typeof value === 'object' && value !== null;
}

function assertText(value: unknown, label: string): string {
    if (typeof value !== 'string' || value.length === 0) {
        throw new TypeError(`Missing ${label}.`);
    }

    return value;
}

async function assertCleanWorktree(): Promise<void> {
    const status = await git(['status', '--porcelain']);
    if (status.trim().length === 0) {
        return;
    }

    throw new Error('Source archive requires a clean git worktree.');
}

async function git(args: readonly string[]): Promise<string> {
    return run('git', args);
}

async function run(command: string, args: readonly string[]): Promise<string> {
    return new Promise((resolvePromise, rejectPromise) => {
        const child = spawn(command, [...args], {
            cwd: fileURLToPath(REPO_ROOT),
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (chunk: Buffer) => {
            stdout += chunk.toString('utf8');
        });
        child.stderr.on('data', (chunk: Buffer) => {
            stderr += chunk.toString('utf8');
        });
        child.on('error', rejectPromise);
        child.on('close', (code) => {
            if (code === 0) {
                resolvePromise(stdout);
                return;
            }

            rejectPromise(new Error(`${command} ${args.join(' ')} failed.\n${stderr}`));
        });
    });
}

async function sha256File(path: string): Promise<string> {
    const hash = createHash('sha256');
    hash.update(await readFile(path));
    return hash.digest('hex');
}

void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
});
