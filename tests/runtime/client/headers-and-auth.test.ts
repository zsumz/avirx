import { describe, expect, it } from 'vitest';
import { avirx } from 'avirx';

describe('avirx client factory', () => {
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
