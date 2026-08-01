import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { assertCondition } from './assertion.mts';

const forbiddenPatterns = [
    /from\s+["']node:/u,
    /import\s*\(\s*["']node:/u,
    /require\s*\(\s*["']node:/u,
    /\bprocess\./u,
    /\bBuffer\./u,
];

export async function assertNoNodeRuntimeImports(directory: string): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) {
            await assertNoNodeRuntimeImports(path);
            continue;
        }
        if (!entry.isFile() || !entry.name.endsWith('.js')) {
            continue;
        }

        const source = await readFile(path, 'utf8');
        for (const pattern of forbiddenPatterns) {
            assertCondition(
                !pattern.test(source),
                `Packed browser dist contains Node runtime usage in ${path}: ${String(pattern)}`,
            );
        }
    }
}
