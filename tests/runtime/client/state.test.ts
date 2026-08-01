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
});
