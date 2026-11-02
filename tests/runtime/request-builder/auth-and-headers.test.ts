import { describe, expect, it, vi } from 'vitest';
import { avirx } from 'avirx';

describe('HTTP method builders', () => {
    it('forks request-level bearer auth without mutating previous builders', () => {
        const builder = avirx('https://api.example.com')
            .auth.bearer(() => 'client-token')
            .get('/events');
        const withAuth = builder.auth.bearer(() => 'request-token');

        expect(builder.state.auth).toBeUndefined();
        expect(withAuth.state.auth).toEqual({
            kind: 'bearer',
            token: '[redacted]',
        });
        expect(withAuth.clientState.auth).toEqual({
            kind: 'bearer',
            token: '[redacted]',
        });
    });

    it('redacts request-level auth state without changing execution auth', async () => {
        const fetchImpl = vi.fn<typeof fetch>(async () => Promise.resolve(new Response('ok')));
        const builder = avirx('https://api.example.com', { fetch: fetchImpl })
            .auth.basic('client', 'client-password')
            .post('/events')
            .auth.apiKey('X-Request-Key', () => 'request-secret');

        expect(builder.clientState.auth).toEqual({
            kind: 'basic',
            password: '[redacted]',
            username: 'client',
        });
        expect(builder.state.auth).toEqual({
            key: '[redacted]',
            kind: 'api-key-header',
            name: 'X-Request-Key',
        });
        expect(JSON.stringify(builder.clientState.auth)).not.toContain('client-password');
        expect(JSON.stringify(builder.state.auth)).not.toContain('request-secret');

        await builder.send();

        expect(fetchImpl.mock.calls[0]?.[0]).toEqual(new URL('https://api.example.com/events'));
        expect(new Headers(fetchImpl.mock.calls[0]?.[1]?.headers).get('x-request-key'))
            .toBe('request-secret');
    });

    it('forks request-level headers without mutating previous builders', () => {
        const builder = avirx('https://api.example.com').post('/events');
        const withHeaders = builder
            .header('Accept', 'application/json')
            .headers({ 'X-Request': 'req_123' });

        expect(builder.state.headers).toEqual({});
        expect(withHeaders.state.headers).toEqual({
            accept: 'application/json',
            'x-request': 'req_123',
        });
        expect(Object.isFrozen(withHeaders.state.headers)).toBe(true);
    });

    it('keeps request headers separate so they can override client headers', () => {
        const builder = avirx('https://api.example.com')
            .header('Accept', 'application/json')
            .get('/users')
            .header('Accept', 'text/plain');

        expect(builder.clientState.headers).toEqual({ accept: 'application/json' });
        expect(builder.state.headers).toEqual({ accept: 'text/plain' });
    });
});
