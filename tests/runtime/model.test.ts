import { describe, expect, it, vi } from 'vitest';

import {
    createClientState,
    createRequestState,
    forkClientState,
    forkRequestState,
} from '../../src/internals/model.js';

describe('core internal model', () => {
    it('represents client state without touching fetch', () => {
        const fetchImpl = vi.fn<typeof fetch>();
        const state = createClientState(new URL('https://api.example.com'));
        const next = forkClientState(state, { fetch: fetchImpl, name: 'example', timeoutMs: 500 });

        expect(fetchImpl).not.toHaveBeenCalled();
        expect(Object.isFrozen(state)).toBe(true);
        expect(Object.isFrozen(next)).toBe(true);
        expect(state).not.toBe(next);
        expect(state.name).toBeUndefined();
        expect(next.name).toBe('example');
        expect(next.baseUrl.href).toBe('https://api.example.com/');
    });

    it('forks request state without mutating the original', () => {
        const state = createRequestState('GET', '/users/{id}');
        const next = forkRequestState(state, {
            expectedStatuses: [200],
            headers: { accept: 'application/json' },
            pathParams: { id: 'usr_123' },
            query: { include: ['teams', 'roles'] },
        });

        expect(Object.isFrozen(state)).toBe(true);
        expect(Object.isFrozen(next)).toBe(true);
        expect(Object.isFrozen(next.headers)).toBe(true);
        expect(Object.isFrozen(next.pathParams)).toBe(true);
        expect(Object.isFrozen(next.query)).toBe(true);
        expect(state).not.toBe(next);
        expect(state.expectedStatuses.has(200)).toBe(false);
        expect(state.headers).toEqual({});
        expect(next.expectedStatuses.has(200)).toBe(true);
        expect(next.pathParams.id).toBe('usr_123');
    });

    it('copies patch records so callers cannot mutate request state through aliases', () => {
        const headers = { accept: 'application/json' };
        const next = forkRequestState(createRequestState('POST', '/events'), { headers });

        headers.accept = 'text/plain';

        expect(next.headers.accept).toBe('application/json');
    });
});
