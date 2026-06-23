import { describe, expect, it } from 'vitest';

import { avirx } from 'avirx';

describe('avirx client factory', () => {
    it('stores the base URL', () => {
        const client = avirx('https://api.example.com/v1');

        expect(client.state.baseUrl.href).toBe('https://api.example.com/v1');
        expect(Object.isFrozen(client)).toBe(true);
    });

    it('exposes base URL snapshots that cannot mutate later requests', async () => {
        const client = avirx('https://api.example.com/v1');
        const exposedBaseUrl = client.state.baseUrl;

        exposedBaseUrl.pathname = '/rewritten';

        expect(client.state.baseUrl.href).toBe('https://api.example.com/v1');
        expect((await client.get('/users').build()).url.href).toBe(
            'https://api.example.com/v1/users',
        );
    });

    it('forks named clients without mutating the original', () => {
        const client = avirx('https://api.example.com');
        const named = client.name('example');

        expect(client).not.toBe(named);
        expect(client.state.name).toBeUndefined();
        expect(named.state.name).toBe('example');
    });

    it('normalizes client-level timeouts', () => {
        const client = avirx('https://api.example.com').timeout('5s');

        expect(client.state.timeoutMs).toBe(5000);
        expect(client.timeout(250).state.timeoutMs).toBe(250);
    });

    it('normalizes client-level retry policy', () => {
        const client = avirx('https://api.example.com').retry({ attempts: 2, on: [503] });

        expect(client.state.retry).toEqual({
            attempts: 2,
            on: [503],
            safeOnly: true,
        });
    });

    it('configures client-level cancellation signals without mutating previous clients', () => {
        const client = avirx('https://api.example.com');
        const controller = new AbortController();
        const signaled = client.signal(controller.signal);
        const clone = signaled.header('x-client', 'clone');

        expect(client.state.signal).toBeUndefined();
        expect(signaled.state.signal).toBe(controller.signal);
        expect(clone.state.signal).toBe(controller.signal);
    });

    it('configures client-level concurrency without mutating previous clients', () => {
        const client = avirx('https://api.example.com');
        const limited = client.concurrency(2);
        const clone = limited.auth.bearer(() => 'token');

        expect(client.state.concurrency).toBeUndefined();
        expect(limited.state.concurrency?.max).toBe(2);
        expect(limited.state.concurrency?.active()).toBe(0);
        expect(limited.state.concurrency?.queued()).toBe(0);
        expect(clone.state.concurrency).toBe(limited.state.concurrency);
    });

    it('rejects invalid client-level concurrency limits', () => {
        const client = avirx('https://api.example.com');

        expect(() => client.concurrency(0)).toThrow(TypeError);
        expect(() => client.concurrency(1.5)).toThrow(TypeError);
        expect(() => client.concurrency(Number.POSITIVE_INFINITY)).toThrow(TypeError);
    });

    it('configures client-level rate limits without mutating previous clients', () => {
        const client = avirx('https://api.example.com');
        const limited = client.rateLimit({ per: '1s', requests: 2 });
        const clone = limited.auth.bearer(() => 'token');

        expect(client.state.rateLimit).toBeUndefined();
        expect(limited.state.rateLimit?.requests).toBe(2);
        expect(limited.state.rateLimit?.perMs).toBe(1000);
        expect(limited.state.rateLimit?.queued()).toBe(0);
        expect(clone.state.rateLimit).toBe(limited.state.rateLimit);
    });

    it('configures client-level cache without mutating previous clients', () => {
        const client = avirx('https://api.example.com');
        const cached = client.cache({ maxBytes: 1024, ttl: '1s', vary: ['accept-language'] });
        const clone = cached.header('x-client', 'clone');

        expect(client.state.cache).toBeUndefined();
        expect(cached.state.cache?.maxBytes).toBe(1024);
        expect(cached.state.cache?.ttlMs).toBe(1000);
        expect(cached.state.cache?.size()).toBe(0);
        expect(clone.state.cache).toBe(cached.state.cache);
    });

    it('rejects invalid client-level cache policies', () => {
        const client = avirx('https://api.example.com');

        expect(() => client.cache({ ttl: '0ms' })).toThrow(TypeError);
        expect(() => client.cache({ methods: [], ttl: '1s' })).toThrow(TypeError);
        expect(() => client.cache({ methods: ['POST'], ttl: '1s' } as never)).toThrow(TypeError);
        expect(() => client.cache({ ttl: '1s', vary: [''] })).toThrow(TypeError);
        expect(() => client.cache({ ttl: '1s', vary: ['authorization'] })).toThrow(TypeError);
        expect(() => client.cache({ maxBytes: -1, ttl: '1s' })).toThrow(TypeError);
        expect(() => client.cache({ maxBytes: 1.5, ttl: '1s' })).toThrow(TypeError);
    });

    it('rejects invalid client-level rate limits', () => {
        const client = avirx('https://api.example.com');

        expect(() => client.rateLimit({ per: '1s', requests: 0 })).toThrow(TypeError);
        expect(() => client.rateLimit({ per: '1s', requests: 1.5 })).toThrow(TypeError);
        expect(() => client.rateLimit({ per: '0ms', requests: 1 })).toThrow(TypeError);
        expect(() => client.rateLimit({ per: '1s', queue: -1, requests: 1 })).toThrow(TypeError);
        expect(() => client.rateLimit({ per: '1s', queueTimeout: '0ms', requests: 1 })).toThrow(TypeError);
    });

    it('forks hooks without mutating previous clients', () => {
        const client = avirx('https://api.example.com');
        const handler = (): void => {
            return;
        };
        const withHook = client.on('request', handler);

        expect(client.state.hooks).toBeUndefined();
        expect(withHook.state.hooks?.request).toEqual([handler]);
        expect(Object.isFrozen(withHook.state.hooks)).toBe(true);
    });

    it('merges and normalizes client-level headers', () => {
        const client = avirx('https://api.example.com')
            .header('X-Trace', 'trace_123')
            .headers({ 'X-Client': 'avirx' })
            .headers({ Accept: 'application/json' });

        expect(client.state.headers).toEqual({
            accept: 'application/json',
            'x-client': 'avirx',
            'x-trace': 'trace_123',
        });
        expect(Object.isFrozen(client.state.headers)).toBe(true);
    });

    it('does not mutate previous clients when applying headers', () => {
        const client = avirx('https://api.example.com');
        const withHeader = client.headers({ Authorization: 'Bearer token' });

        expect(client.state.headers).toEqual({});
        expect(withHeader.state.headers).toEqual({ authorization: 'Bearer token' });
    });

    it('forks bearer auth without mutating previous clients', () => {
        const client = avirx('https://api.example.com');
        const withAuth = client.auth.bearer(() => 'token');

        expect(client.state.auth).toBeUndefined();
        expect(withAuth.state.auth).toEqual({
            kind: 'bearer',
            token: '[redacted]',
        });
    });

    it('redacts client auth policies in public state', () => {
        const client = avirx('https://api.example.com');

        expect(client.auth.basic('user', 'super-secret').state.auth).toEqual({
            kind: 'basic',
            password: '[redacted]',
            username: 'user',
        });
        expect(client.auth.apiKey('X-Api-Key', () => 'secret-api-token').state.auth).toEqual({
            key: '[redacted]',
            kind: 'api-key-header',
            name: 'X-Api-Key',
        });
        expect(client.auth.query('api_key', () => 'key').state.auth).toEqual({
            key: '[redacted]',
            kind: 'api-key-query',
            name: 'api_key',
        });

        expect(JSON.stringify(client.auth.basic('user', 'super-secret').state.auth)).not.toContain('super-secret');
        expect(JSON.stringify(client.auth.apiKey('X-Api-Key', () => 'secret-api-token').state.auth)).not.toContain(
            'secret-api-token',
        );
    });

    it('rejects undefined client header values', () => {
        const client = avirx('https://api.example.com');

        expect(() => client.headers({ 'x-client': undefined } as never)).toThrow(TypeError);
        expect(() => client.header('x-client', undefined as never)).toThrow(TypeError);
    });
});
