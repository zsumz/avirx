import { readdir, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import type { PackedFile } from './pack-metadata.mts';

export async function collectInstalledFiles(directory: string): Promise<readonly PackedFile[]> {
    const files: PackedFile[] = [];
    await collect(directory, directory, files);
    return files.sort((left, right) => left.path.localeCompare(right.path));
}

async function collect(
    root: string,
    directory: string,
    files: PackedFile[],
): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) {
            await collect(root, path, files);
            continue;
        }
        if (entry.isFile()) {
            files.push({
                path: relative(root, path),
                size: (await stat(path)).size,
            });
        }
    }
}
