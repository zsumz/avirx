import { describe, expect, it } from 'vitest';
import { createAbortScope } from '../../../src/transport/abort.js';

describe('abort utilities', () => {
    it('composes abort signals while preserving the abort reason', () => {
        const first = new AbortController();
        const second = new AbortController();
        const reason = new Error('stop');
        const scope = createAbortScope([first.signal, second.signal]);

        second.abort(reason);

        expect(scope.signal?.aborted).toBe(true);
        expect(scope.signal?.reason).toBe(reason);
        scope.cancel();
    });
});
