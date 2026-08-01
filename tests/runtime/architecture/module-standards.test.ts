import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { relative, resolve } from 'node:path';

describe('source architecture', () => {
    it('keeps cache policy internals split by responsibility', () => {
        const expectedModules = [
            'src/policy/cache/keys.ts',
            'src/policy/cache/options.ts',
            'src/policy/cache/response.ts',
            'src/policy/cache/store.ts',
        ];

        for (const modulePath of expectedModules) {
            expect(readText(modulePath).length, modulePath).toBeGreaterThan(0);
        }

        const facade = readText('src/policy/cache/cache.ts');
        expect(facade).not.toContain('normalizeDurationMs');
        expect(facade).not.toContain('JSON.stringify(parts)');
        expect(facade).not.toContain('response.native.clone().arrayBuffer()');
    });

    it('keeps src and tests implemented as TypeScript files', () => {
        const violations = listFiles(['src', 'tests'])
            .filter((filePath) => !filePath.endsWith('.ts'))
            .map((filePath) => relative(REPO_ROOT, filePath));

        expect(violations).toEqual([]);
    });

    it('keeps TypeScript source lines within the readable width budget', () => {
        const violations = listSourceFiles(TYPESCRIPT_SOURCE_ROOTS)
            .flatMap((filePath) => {
                const text = readFileSync(filePath, 'utf8');
                return text.split(/\r?\n/u).flatMap((line, index) => {
                    if (line.length <= MAX_TYPESCRIPT_LINE_LENGTH) {
                        return [];
                    }

                    const relativePath = relative(REPO_ROOT, filePath);
                    return `${relativePath}:${String(index + 1)} has ${String(line.length)} chars`;
                });
            });

        expect(violations).toEqual([]);
    });
});

const REPO_ROOT = resolve(import.meta.dirname, '../../..');

const MAX_TYPESCRIPT_LINE_LENGTH = 120;

const TYPESCRIPT_SOURCE_ROOTS = [
    'src',
    'tests',
    'vitest.config.ts',
    'eslint.config.js',
] as const;

function readText(path: string): string {
    return readFileSync(resolve(REPO_ROOT, path), 'utf8');
}

function listSourceFiles(paths: readonly string[]): string[] {
    return paths.flatMap((path) => {
        const absolutePath = resolve(REPO_ROOT, path);
        const stat = statSync(absolutePath);

        if (stat.isFile()) {
            return isCheckedSourceFile(absolutePath) ? [absolutePath] : [];
        }

        return readdirSync(absolutePath)
            .filter((entry) => !entry.startsWith('.'))
            .flatMap((entry) => listSourceFiles([resolve(absolutePath, entry)]));
    });
}

function listFiles(paths: readonly string[]): string[] {
    return paths.flatMap((path) => {
        const absolutePath = resolve(REPO_ROOT, path);
        const stat = statSync(absolutePath);

        if (stat.isFile()) {
            return [absolutePath];
        }

        return readdirSync(absolutePath)
            .filter((entry) => !entry.startsWith('.'))
            .flatMap((entry) => listFiles([resolve(absolutePath, entry)]));
    });
}

function isCheckedSourceFile(path: string): boolean {
    return path.endsWith('.ts') || path.endsWith('.js');
}
