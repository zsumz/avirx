import { afterEach, describe, expect, it, vi } from 'vitest';
import { avirx } from 'avirx';

describe('fetch execution', () => {
    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('throws AvirxError for unexpected default HTTP statuses', async () => {
        const fetchImpl = vi.fn<typeof fetch>(async () => Promise.resolve(new Response('missing', { status: 404 })));

        await expect(
            avirx('https://api.example.com', { fetch: fetchImpl }).get('/missing').send(),
        ).rejects.toMatchObject({
            message: 'Unexpected HTTP status 404.',
            name: 'AvirxError',
            status: 404,
        });
    });

    it('throws AvirxError for explicit status expectation failures', async () => {
        const fetchImpl = vi.fn<typeof fetch>(async () => Promise.resolve(new Response('ok', { status: 200 })));

        await expect(
            avirx('https://api.example.com', { fetch: fetchImpl }).post('/events').expect(201).send(),
        ).rejects.toMatchObject({
            message: 'Unexpected HTTP status 200.',
            response: {
                status: 200,
            },
            status: 200,
        });
    });

    it('throws AvirxError for network failures with request metadata', async () => {
        const cause = new Error('socket broke');
        const fetchImpl = vi.fn<typeof fetch>(async () => Promise.reject(cause));

        await expect(avirx('https://api.example.com', { fetch: fetchImpl }).get('/users/{id}').path({
            id: 'usr_123',
        }).send()).rejects.toMatchObject({
            cause,
            message: 'Request failed.',
            request: {
                method: 'GET',
            },
        });
    });

    it('throws AvirxError for timeout failures', async () => {
        const fetchImpl = vi.fn<typeof fetch>(
            async (_input, init) =>
                new Promise<Response>((_resolve, reject) => {
                    init?.signal?.addEventListener('abort', () => {
                        reject(new DOMException('Aborted', 'AbortError'));
                    });
                }),
        );

        await expect(
            avirx('https://api.example.com', { fetch: fetchImpl })
                .timeout('1ms')
                .get('/slow')
                .send(),
        ).rejects.toMatchObject({
            message: 'Request timed out.',
            name: 'AvirxError',
            request: {
                timeoutMs: 1,
            },
        });
    });
});
