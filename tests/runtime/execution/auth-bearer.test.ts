import { afterEach, describe, expect, it, vi } from 'vitest';
import { avirx } from 'avirx';

describe('fetch execution', () => {
    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('evaluates bearer auth lazily at request time', async () => {
        const token = vi.fn(() => 'client-token');
        const fetchImpl = vi.fn<typeof fetch>(async () => Promise.resolve(new Response('ok')));
        const request = avirx('https://api.example.com', { fetch: fetchImpl }).auth.bearer(token).get('/users');

        expect(token).not.toHaveBeenCalled();

        const response = await request.send();

        expect(token).toHaveBeenCalledOnce();
        expect(new Headers(fetchImpl.mock.calls[0]?.[1]?.headers).get('authorization'))
            .toBe('Bearer client-token');
        expect(response.request.redactedHeaders.authorization).toBe('[redacted]');
    });

    it('supports async bearer auth tokens', async () => {
        const fetchImpl = vi.fn<typeof fetch>(async () => Promise.resolve(new Response('ok')));

        await avirx('https://api.example.com', { fetch: fetchImpl })
            .auth.bearer(async () => Promise.resolve('async-token'))
            .get('/users')
            .send();

        expect(new Headers(fetchImpl.mock.calls[0]?.[1]?.headers).get('authorization'))
            .toBe('Bearer async-token');
    });

    it('lets request-level bearer auth override client bearer auth', async () => {
        const fetchImpl = vi.fn<typeof fetch>(async () => Promise.resolve(new Response('ok')));

        await avirx('https://api.example.com', { fetch: fetchImpl })
            .auth.bearer(() => 'client-token')
            .get('/users')
            .auth.bearer(() => 'request-token')
            .send();

        expect(new Headers(fetchImpl.mock.calls[0]?.[1]?.headers).get('authorization'))
            .toBe('Bearer request-token');
    });

    it('lets request authorization headers override client bearer auth', async () => {
        const fetchImpl = vi.fn<typeof fetch>(async () => Promise.resolve(new Response('ok')));

        await avirx('https://api.example.com', { fetch: fetchImpl })
            .auth.bearer(() => 'client-token')
            .get('/users')
            .header('Authorization', 'Bearer explicit-token')
            .send();

        expect(new Headers(fetchImpl.mock.calls[0]?.[1]?.headers).get('authorization'))
            .toBe('Bearer explicit-token');
    });

    it('sets basic authorization headers', async () => {
        const fetchImpl = vi.fn<typeof fetch>(async () => Promise.resolve(new Response('ok')));

        const response = await avirx('https://api.example.com', { fetch: fetchImpl })
            .auth.basic('user', 'pass')
            .get('/users')
            .send();

        expect(new Headers(fetchImpl.mock.calls[0]?.[1]?.headers).get('authorization'))
            .toBe('Basic dXNlcjpwYXNz');
        expect(response.request.redactedHeaders.authorization).toBe('[redacted]');
    });
});
