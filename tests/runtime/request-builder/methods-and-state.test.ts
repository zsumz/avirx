import { describe, expect, it } from 'vitest';
import { avirx, type HttpMethod } from 'avirx';

describe('HTTP method builders', () => {
    it.each([
        ['delete', 'DELETE'],
        ['get', 'GET'],
        ['head', 'HEAD'],
        ['options', 'OPTIONS'],
        ['patch', 'PATCH'],
        ['post', 'POST'],
        ['put', 'PUT'],
    ] as const)('creates a %s request builder', (methodName, method) => {
        const client = avirx('https://api.example.com');
        const builder = client[methodName]('/users/{id}');

        expect(Object.isFrozen(builder)).toBe(true);
        expect(builder.clientState).toBe(client.state);
        expect(builder.state.method satisfies HttpMethod).toBe(method);
        expect(builder.state.route).toBe('/users/{id}');
    });

    it('preserves client-level defaults on request builders', () => {
        const client = avirx('https://api.example.com')
            .headers({ Authorization: 'Bearer token' })
            .timeout('5s');
        const builder = client.post('/events');

        expect(builder.clientState.headers).toEqual({ authorization: 'Bearer token' });
        expect(builder.clientState.timeoutMs).toBe(5000);
        expect(builder.state.headers).toEqual({});
    });

    it('forks request-level timeouts without mutating previous builders', () => {
        const builder = avirx('https://api.example.com').get('/events');
        const withTimeout = builder.timeout('250ms');
        const withoutTimeout = withTimeout.timeout(false);

        expect(builder.state.timeoutMs).toBeUndefined();
        expect(withTimeout.state.timeoutMs).toBe(250);
        expect(withoutTimeout.state.timeoutMs).toBe(false);
    });

    it('forks request-level retry policy without mutating previous builders', () => {
        const builder = avirx('https://api.example.com').get('/events');
        const withRetry = builder.retry(2);

        expect(builder.state.retry).toBeUndefined();
        expect(withRetry.state.retry).toMatchObject({
            attempts: 2,
            safeOnly: true,
        });
    });

    it('forks request-level hooks without mutating previous builders', () => {
        const builder = avirx('https://api.example.com').get('/events');
        const handler = (): void => {
            return;
        };
        const withHook = builder.on('response', handler);

        expect(builder.state.hooks).toBeUndefined();
        expect(withHook.state.hooks?.response).toEqual([handler]);
        expect(Object.isFrozen(withHook.state.hooks)).toBe(true);
    });
});
