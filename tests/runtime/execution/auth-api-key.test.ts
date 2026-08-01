import { afterEach, describe, expect, it, vi } from 'vitest';
import { avirx } from 'avirx';

describe('fetch execution', () => {
    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('evaluates header API keys lazily at request time', async () => {
        const key = vi.fn(() => 'secret-key');
        const fetchImpl = vi.fn<typeof fetch>(async () => Promise.resolve(new Response('ok')));
        const request = avirx('https://api.example.com', { fetch: fetchImpl }).auth.apiKey('X-Api-Key', key).get(
            '/users',
        );

        expect(key).not.toHaveBeenCalled();

        const response = await request.send();

        expect(key).toHaveBeenCalledOnce();
        expect(fetchImpl.mock.calls[0]?.[1]).toMatchObject({
            headers: {
                'x-api-key': 'secret-key',
            },
        });
        expect(response.request.redactedHeaders['x-api-key']).toBe('[redacted]');
    });

    it('evaluates query API keys lazily and redacts them in request metadata', async () => {
        const key = vi.fn(async () => Promise.resolve('secret-key'));
        const fetchImpl = vi.fn<typeof fetch>(async () => Promise.resolve(new Response('ok')));
        const request = avirx('https://api.example.com', { fetch: fetchImpl })
            .auth.query('api_key', key)
            .get('/users')
            .query({ tag: 'a' });

        expect(key).not.toHaveBeenCalled();

        const response = await request.send();

        expect(key).toHaveBeenCalledOnce();
        expect(formatFetchInput(fetchImpl.mock.calls[0]?.[0])).toBe(
            'https://api.example.com/users?api_key=secret-key&tag=a',
        );
        expect(response.request.url.href).toBe('https://api.example.com/users?api_key=secret-key&tag=a');
        expect(response.request.redactedUrl.href).toBe('https://api.example.com/users?api_key=%5Bredacted%5D&tag=a');
    });

    it('lets request-level API key auth override client auth', async () => {
        const fetchImpl = vi.fn<typeof fetch>(async () => Promise.resolve(new Response('ok')));

        await avirx('https://api.example.com', { fetch: fetchImpl })
            .auth.apiKey('x-api-key', () => 'client-key')
            .get('/users')
            .auth.apiKey('x-request-key', () => 'request-key')
            .send();

        expect(fetchImpl.mock.calls[0]?.[1]).toMatchObject({
            headers: {
                'x-request-key': 'request-key',
            },
        });
        expect(fetchImpl.mock.calls[0]?.[1]).not.toMatchObject({
            headers: {
                'x-api-key': 'client-key',
            },
        });
    });
});

function formatFetchInput(input: Parameters<typeof fetch>[0] | undefined): string {
    if (typeof input === 'string') {
        return input;
    }
    if (input instanceof URL) {
        return input.href;
    }
    if (input instanceof Request) {
        return input.url;
    }

    throw new TypeError('Expected fetch input to be present.');
}
