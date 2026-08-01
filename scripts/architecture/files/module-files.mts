import { readdir } from 'node:fs/promises';
import path from 'node:path';

const moduleExtensions = new Set(['.js', '.mjs', '.mts', '.ts']);

export async function collectModuleFiles(root: string): Promise<string[]> {
    const files: string[] = [];
    await visitDirectory(root, files);
    return files.sort((left, right) => left.localeCompare(right));
}

async function visitDirectory(directory: string, files: string[]): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true });

    for (const entry of entries) {
        const target = path.join(directory, entry.name);
        if (entry.isDirectory()) {
            await visitDirectory(target, files);
        } else if (entry.isFile() && moduleExtensions.has(path.extname(entry.name))) {
            files.push(target);
        }
    }
}

export function relativePath(root: string, file: string): string {
    return path.relative(root, file).split(path.sep).join('/');
}
