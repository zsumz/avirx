import { describe, expect, it } from 'vitest';
import { avirx } from 'avirx';

describe('avirx client factory', () => {
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
});
