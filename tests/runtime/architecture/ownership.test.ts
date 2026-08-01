import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('source architecture', () => {
    it('keeps client and request state lifecycles split by responsibility', () => {
        expectModules([
            'src/client/state/create-client-state.ts',
            'src/client/state/fork-client-state.ts',
            'src/client/state/freeze-client-state.ts',
            'src/client/state/client-state-types.ts',
            'src/request/state/create-request-state.ts',
            'src/request/state/fork-request-state.ts',
            'src/request/state/freeze-request-state.ts',
            'src/request/state/request-state-types.ts',
        ]);
    });

    it('removes the legacy internals facade', () => {
        expect(existsSync(resolve(REPO_ROOT, 'src/internals/model.ts'))).toBe(false);
    });

    it('keeps execution orchestration split by responsibility', () => {
        expectModules([
            'src/execution/attempt.ts',
            'src/execution/cache.ts',
            'src/execution/complete-attempt.ts',
            'src/execution/errors.ts',
            'src/execution/execute-expected-request.ts',
            'src/execution/fetch-init.ts',
            'src/execution/hooks.ts',
            'src/execution/request-budget.ts',
            'src/execution/retry.ts',
            'src/execution/retry-decision.ts',
        ]);
        expect(readText('src/execution/execute-expected-request.ts')).not.toContain('fetchImpl');
        expect(readText('src/execution/retry.ts')).toContain('executeRequestAttempt');
        expect(readText('src/execution/fetch-init.ts')).toContain('toFetchBody');
    });

    it('keeps rate-limit queue and window mechanics split by responsibility', () => {
        expectModules([
            'src/policy/rate-limit/options.ts',
            'src/policy/rate-limit/queue.ts',
            'src/policy/rate-limit/window.ts',
        ]);
        const facade = readText('src/policy/rate-limit/rate-limit.ts');
        expect(facade).not.toContain('startsHead');
        expect(facade).not.toContain('queueHead');
        expect(facade).not.toContain('normalizeDurationMs');
    });
});

const REPO_ROOT = resolve(import.meta.dirname, '../../..');

function expectModules(paths: readonly string[]): void {
    for (const path of paths) {
        expect(readText(path).length, path).toBeGreaterThan(0);
    }
}

function readText(path: string): string {
    return readFileSync(resolve(REPO_ROOT, path), 'utf8');
}
