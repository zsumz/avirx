import { describe, expect, it } from 'vitest';

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { relative, resolve } from 'node:path';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const MAX_TYPESCRIPT_LINE_LENGTH = 120;

const TYPESCRIPT_SOURCE_ROOTS = [
    'src',
    'tests',
    'vitest.config.ts',
    'eslint.config.js',
] as const;

describe('source architecture', () => {
    it('keeps the internal state model split by responsibility', () => {
        const expectedModules = [
            'src/internals/client-state.ts',
            'src/internals/request-state.ts',
            'src/internals/state-redaction.ts',
            'src/internals/freeze.ts',
        ];

        for (const modulePath of expectedModules) {
            expect(readText(modulePath).length, modulePath).toBeGreaterThan(0);
        }

        expect(readText('src/internals/model.ts').trim()).toBe([
            'export { createClientState, forkClientState } from \'./client-state.js\';',
            'export { createRequestState, forkRequestState } from \'./request-state.js\';',
            'export { getRawAuthPolicy } from \'./state-redaction.js\';',
        ].join('\n'));
    });

    it('keeps production imports pointed at the split state modules', () => {
        const staleImports = listSourceFiles(['src'])
            .filter((filePath) => !filePath.endsWith('src/internals/model.ts'))
            .filter((filePath) => readFileSync(filePath, 'utf8').includes('internals/model.js'))
            .map((filePath) => relative(REPO_ROOT, filePath));

        expect(staleImports).toEqual([]);
    });

    it('keeps execution orchestration split by responsibility', () => {
        const expectedModules = [
            'src/execution-attempt.ts',
            'src/execution-cache.ts',
            'src/execution-errors.ts',
            'src/execution-hooks.ts',
            'src/execution-retry.ts',
        ];

        for (const modulePath of expectedModules) {
            expect(readText(modulePath).length, modulePath).toBeGreaterThan(0);
        }

        const facade = readText('src/execution.ts');
        expect(facade).not.toContain('fetchImpl');
        expect(facade).not.toContain('calculateRetryDelayMs');
        expect(facade).not.toContain('clientState.cache?.set');
        expect(readText('src/execution-retry.ts')).toContain('executeRequestAttempt');
        expect(readText('src/execution-attempt.ts')).toContain('createFetchInit');
    });

    it('keeps rate-limit queue and window mechanics split by responsibility', () => {
        const expectedModules = [
            'src/internals/rate-limit-options.ts',
            'src/internals/rate-limit-queue.ts',
            'src/internals/rate-limit-window.ts',
        ];

        for (const modulePath of expectedModules) {
            expect(readText(modulePath).length, modulePath).toBeGreaterThan(0);
        }

        const facade = readText('src/internals/rate-limit.ts');
        expect(facade).not.toContain('startsHead');
        expect(facade).not.toContain('queueHead');
        expect(facade).not.toContain('normalizeDurationMs');
    });

    it('keeps cache policy internals split by responsibility', () => {
        const expectedModules = [
            'src/internals/cache-keys.ts',
            'src/internals/cache-options.ts',
            'src/internals/cache-response.ts',
            'src/internals/cache-store.ts',
        ];

        for (const modulePath of expectedModules) {
            expect(readText(modulePath).length, modulePath).toBeGreaterThan(0);
        }

        const facade = readText('src/internals/cache.ts');
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
