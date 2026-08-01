import { afterEach, describe, expect, it, vi } from 'vitest';
import { avirx } from 'avirx';

describe('fetch execution', () => {
    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('runs request and response hooks around fetch', async () => {
        const events: string[] = [];
        const fetchImpl = vi.fn<typeof fetch>(async () => Promise.resolve(new Response('ok')));

        const response = await avirx('https://api.example.com', { fetch: fetchImpl })
            .on('request', (context) => {
                events.push(`client request ${context.request().method}`);
                expect(context.response()).toBeUndefined();
            })
            .get('/users')
            .on('response', (context) => {
                events.push(`request response ${String(context.response()?.status)}`);
                expect(context.request().url.href).toBe('https://api.example.com/users');
            })
            .send();

        expect(response.status).toBe(200);
        expect(events).toEqual(['client request GET', 'request response 200']);
    });

    it('keeps request hook URL mutations from rewriting fetch destinations', async () => {
        const fetchImpl = vi.fn<typeof fetch>(async () => Promise.resolve(new Response('ok')));

        await avirx('https://api.example.com', { fetch: fetchImpl })
            .get('/users')
            .on('request', (context) => {
                const url = context.request().url;
                const redactedUrl = context.request().redactedUrl;

                url.pathname = '/rewritten';
                redactedUrl.pathname = '/rewritten-redacted';

                expect(context.request().url.href).toBe('https://api.example.com/users');
                expect(context.request().redactedUrl.href).toBe('https://api.example.com/users');
            })
            .send();

        expect(formatFetchInput(fetchImpl.mock.calls[0]?.[0])).toBe('https://api.example.com/users');
    });

    it('runs error hooks after wrapped request errors', async () => {
        const cause = new Error('socket broke');
        const fetchImpl = vi.fn<typeof fetch>(async () => Promise.reject(cause));
        const errors: string[] = [];

        await expect(
            avirx('https://api.example.com', { fetch: fetchImpl })
                .on('error', (context) => {
                    errors.push(context.error()?.message ?? 'missing');
                    expect(context.request().method).toBe('GET');
                })
                .get('/users')
                .send(),
        ).rejects.toMatchObject({
            cause,
            message: 'Request failed.',
        });
        expect(errors).toEqual(['Request failed.']);
    });

    it('runs retry hooks before retry attempts', async () => {
        const retries: string[] = [];
        const fetchImpl = vi
            .fn<typeof fetch>()
            .mockResolvedValueOnce(new Response('busy', { status: 503 }))
            .mockResolvedValueOnce(new Response('ok'));

        await avirx('https://api.example.com', { fetch: fetchImpl })
            .get('/users')
            .retry({ attempts: 1, on: [503] })
            .on('retry', (context) => {
                const retry = context.retry();
                retries.push(`${String(retry?.attempt)}:${String(retry?.status)}:${String(retry?.delayMs)}`);
                expect(context.response()?.status).toBe(503);
            })
            .send();

        expect(retries).toEqual(['1:503:10']);
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
