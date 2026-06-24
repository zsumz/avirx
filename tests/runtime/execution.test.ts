import { afterEach, describe, expect, it, vi } from 'vitest';

import { AvirxError, avirx } from 'avirx';

describe('fetch execution', () => {
    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('executes requests with an injected fetch implementation', async () => {
        const fetchImpl = vi.fn<typeof fetch>(async () =>
            Promise.resolve(
                new Response('accepted', {
                    headers: { 'x-response': 'yes' },
                    status: 202,
                    statusText: 'Accepted',
                }),
            ),
        );

        const response = await avirx('https://api.example.com/v1', { fetch: fetchImpl })
            .post('/users/{id}?existing=1')
            .path({ id: 'usr 123' })
            .query({ tag: ['a', 'b'] })
            .header('X-Request', 'req_123')
            .body({ ok: true })
            .send();

        expect(fetchImpl).toHaveBeenCalledOnce();
        const [input, init] = fetchImpl.mock.calls[0] ?? [];
        expect(formatFetchInput(input)).toBe('https://api.example.com/v1/users/usr%20123?existing=1&tag=a&tag=b');
        expect(init).toMatchObject({
            body: '{"ok":true}',
            headers: {
                'content-type': 'application/json',
                'x-request': 'req_123',
            },
            method: 'POST',
        });
        expect(response.status).toBe(202);
        expect(response.statusText).toBe('Accepted');
        expect(response.ok).toBe(true);
        expect(response.url).toBe('https://api.example.com/v1/users/usr%20123?existing=1&tag=a&tag=b');
        expect(response.headers['x-response']).toBe('yes');
        expect(response.native).toBeInstanceOf(Response);
        expect(response.request.url.href).toBe(
            'https://api.example.com/v1/users/usr%20123?existing=1&tag=a&tag=b',
        );
        expect(response.timing.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('uses global fetch by default', async () => {
        const fetchImpl = vi.fn<typeof fetch>(async () => Promise.resolve(new Response(null, { status: 204 })));
        vi.stubGlobal('fetch', fetchImpl);

        const response = await avirx('https://api.example.com').get('/health').send();

        expect(fetchImpl).toHaveBeenCalledOnce();
        expect(formatFetchInput(fetchImpl.mock.calls[0]?.[0])).toBe('https://api.example.com/health');
        expect(response.status).toBe(204);
        expect(response.ok).toBe(true);
    });

    it('passes an AbortSignal when timeout is configured', async () => {
        const fetchImpl = vi.fn<typeof fetch>(async () => Promise.resolve(new Response('ok')));

        await avirx('https://api.example.com', { fetch: fetchImpl }).timeout('5s').get('/slow').send();

        const init = fetchImpl.mock.calls[0]?.[1];
        expect(init?.signal).toBeInstanceOf(AbortSignal);
    });

    it('passes composed client and request signals to fetch', async () => {
        const clientController = new AbortController();
        const requestController = new AbortController();
        const fetchImpl = vi.fn<typeof fetch>(async () => Promise.resolve(new Response('ok')));

        await avirx('https://api.example.com', { fetch: fetchImpl })
            .signal(clientController.signal)
            .get('/slow')
            .signal(requestController.signal)
            .send();

        const init = fetchImpl.mock.calls[0]?.[1];
        expect(init?.signal).toBeInstanceOf(AbortSignal);
        expect(init?.signal).not.toBe(clientController.signal);
        expect(init?.signal).not.toBe(requestController.signal);
    });

    it('aborts before cache lookup or fetch when the external signal is already aborted', async () => {
        const controller = new AbortController();
        const errors: string[] = [];
        const fetchImpl = vi.fn<typeof fetch>(async () => Promise.resolve(new Response('live')));
        const client = avirx('https://api.example.com', { fetch: fetchImpl })
            .cache({ ttl: '1s' })
            .on('error', (context) => {
                errors.push(context.error()?.message ?? 'missing');
            });

        await client.get('/cached').text();
        controller.abort(new Error('cancelled'));

        await expect(client.get('/cached').signal(controller.signal).text()).rejects.toMatchObject({
            message: 'Request aborted.',
            request: {
                url: new URL('https://api.example.com/cached'),
            },
        });
        expect(fetchImpl).toHaveBeenCalledOnce();
        expect(errors).toEqual(['Request aborted.']);
    });

    it('wraps fetch aborts from external signals', async () => {
        const controller = new AbortController();
        const fetchImpl = vi.fn<typeof fetch>(
            async (_input, init) =>
                new Promise<Response>((_resolve, reject) => {
                    init?.signal?.addEventListener('abort', () => {
                        reject(new DOMException('Aborted', 'AbortError'));
                    });
                }),
        );

        const request = avirx('https://api.example.com', { fetch: fetchImpl })
            .signal(controller.signal)
            .get('/slow')
            .send();
        controller.abort('cancelled');

        await expect(request).rejects.toMatchObject({
            message: 'Request aborted.',
            name: 'AvirxError',
            request: {
                method: 'GET',
            },
        });
    });

    it('returns result-mode errors for external aborts', async () => {
        const controller = new AbortController();
        const fetchImpl = vi.fn<typeof fetch>(async () => Promise.resolve(new Response('ok')));
        controller.abort('cancelled');

        const result = await avirx('https://api.example.com', { fetch: fetchImpl })
            .signal(controller.signal)
            .get('/users')
            .result();

        expect(result.ok).toBe(false);
        if (result.ok) {
            throw new Error('Expected aborted result.');
        }
        expect(result.error.message).toBe('Request aborted.');
        expect(result.status).toBeUndefined();
        expect(result.response).toBeUndefined();
        expect(fetchImpl).not.toHaveBeenCalled();
    });

    it('clears timeout timers after successful fetches', async () => {
        const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
        const fetchImpl = vi.fn<typeof fetch>(async () => Promise.resolve(new Response('ok')));

        await avirx('https://api.example.com', { fetch: fetchImpl }).timeout('5s').get('/fast').send();

        expect(clearTimeoutSpy).toHaveBeenCalledOnce();
    });

    it('lets request-level timeout override client timeout', async () => {
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
                .timeout('5s')
                .get('/slow')
                .timeout('1ms')
                .send(),
        ).rejects.toMatchObject({
            message: 'Request timed out.',
            request: {
                timeoutMs: 1,
            },
        });
    });

    it('lets request-level timeout disable client timeout', async () => {
        const fetchImpl = vi.fn<typeof fetch>(async () => Promise.resolve(new Response('ok')));

        await avirx('https://api.example.com', { fetch: fetchImpl })
            .timeout('1ms')
            .get('/fast')
            .timeout(false)
            .send();

        const init = fetchImpl.mock.calls[0]?.[1];
        expect(init?.signal).toBeUndefined();
    });

    it('evaluates bearer auth lazily at request time', async () => {
        const token = vi.fn(() => 'client-token');
        const fetchImpl = vi.fn<typeof fetch>(async () => Promise.resolve(new Response('ok')));
        const request = avirx('https://api.example.com', { fetch: fetchImpl }).auth.bearer(token).get('/users');

        expect(token).not.toHaveBeenCalled();

        const response = await request.send();

        expect(token).toHaveBeenCalledOnce();
        expect(fetchImpl.mock.calls[0]?.[1]).toMatchObject({
            headers: {
                authorization: 'Bearer client-token',
            },
        });
        expect(response.request.redactedHeaders.authorization).toBe('[redacted]');
    });

    it('supports async bearer auth tokens', async () => {
        const fetchImpl = vi.fn<typeof fetch>(async () => Promise.resolve(new Response('ok')));

        await avirx('https://api.example.com', { fetch: fetchImpl })
            .auth.bearer(async () => Promise.resolve('async-token'))
            .get('/users')
            .send();

        expect(fetchImpl.mock.calls[0]?.[1]).toMatchObject({
            headers: {
                authorization: 'Bearer async-token',
            },
        });
    });

    it('lets request-level bearer auth override client bearer auth', async () => {
        const fetchImpl = vi.fn<typeof fetch>(async () => Promise.resolve(new Response('ok')));

        await avirx('https://api.example.com', { fetch: fetchImpl })
            .auth.bearer(() => 'client-token')
            .get('/users')
            .auth.bearer(() => 'request-token')
            .send();

        expect(fetchImpl.mock.calls[0]?.[1]).toMatchObject({
            headers: {
                authorization: 'Bearer request-token',
            },
        });
    });

    it('lets request authorization headers override client bearer auth', async () => {
        const fetchImpl = vi.fn<typeof fetch>(async () => Promise.resolve(new Response('ok')));

        await avirx('https://api.example.com', { fetch: fetchImpl })
            .auth.bearer(() => 'client-token')
            .get('/users')
            .header('Authorization', 'Bearer explicit-token')
            .send();

        expect(fetchImpl.mock.calls[0]?.[1]).toMatchObject({
            headers: {
                authorization: 'Bearer explicit-token',
            },
        });
    });

    it('sets basic authorization headers', async () => {
        const fetchImpl = vi.fn<typeof fetch>(async () => Promise.resolve(new Response('ok')));

        const response = await avirx('https://api.example.com', { fetch: fetchImpl })
            .auth.basic('user', 'pass')
            .get('/users')
            .send();

        expect(fetchImpl.mock.calls[0]?.[1]).toMatchObject({
            headers: {
                authorization: 'Basic dXNlcjpwYXNz',
            },
        });
        expect(response.request.redactedHeaders.authorization).toBe('[redacted]');
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

    it('retries idempotent requests for configured statuses', async () => {
        const fetchImpl = vi
            .fn<typeof fetch>()
            .mockResolvedValueOnce(new Response('busy', { status: 503 }))
            .mockResolvedValueOnce(new Response('ok'));

        const response = await avirx('https://api.example.com', { fetch: fetchImpl })
            .get('/users')
            .retry({ attempts: 1, on: [503] })
            .send();

        expect(fetchImpl).toHaveBeenCalledTimes(2);
        expect(response.status).toBe(200);
        expect(response.request.retry).toEqual({
            attempts: 1,
            on: [503],
            safeOnly: true,
        });
        expect(response.timing.retryEvents).toEqual([
            {
                attempt: 1,
                delayMs: 10,
                status: 503,
            },
        ]);
    });

    it('does not retry transport failures', async () => {
        const cause = new Error('socket broke');
        const fetchImpl = vi.fn<typeof fetch>(async () => Promise.reject(cause));

        await expect(
            avirx('https://api.example.com', { fetch: fetchImpl }).get('/users').retry(3).send(),
        ).rejects.toMatchObject({
            cause,
            message: 'Request failed.',
        });
        expect(fetchImpl).toHaveBeenCalledOnce();
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

    it('honors Retry-After delta seconds for retryable 429 responses', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(0);
        const fetchImpl = vi
            .fn<typeof fetch>()
            .mockResolvedValueOnce(new Response('busy', {
                headers: { 'retry-after': '1' },
                status: 429,
            }))
            .mockResolvedValueOnce(new Response('ok'));

        const request = avirx('https://api.example.com', { fetch: fetchImpl })
            .get('/users')
            .retry({ attempts: 1, on: [429] })
            .send();

        await vi.advanceTimersByTimeAsync(0);
        expect(fetchImpl).toHaveBeenCalledOnce();

        await vi.advanceTimersByTimeAsync(999);
        expect(fetchImpl).toHaveBeenCalledOnce();

        await vi.advanceTimersByTimeAsync(1);
        const response = await request;

        expect(fetchImpl).toHaveBeenCalledTimes(2);
        expect(response.status).toBe(200);
        expect(response.timing.retryEvents).toEqual([
            {
                attempt: 1,
                delayMs: 1000,
                status: 429,
            },
        ]);
    });

    it('honors Retry-After HTTP dates for retryable 503 responses', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(Date.parse('Wed, 21 Oct 2015 07:28:00 GMT'));
        const fetchImpl = vi
            .fn<typeof fetch>()
            .mockResolvedValueOnce(new Response('busy', {
                headers: { 'retry-after': 'Wed, 21 Oct 2015 07:28:02 GMT' },
                status: 503,
            }))
            .mockResolvedValueOnce(new Response('ok'));

        const responsePromise = avirx('https://api.example.com', { fetch: fetchImpl })
            .get('/users')
            .retry({ attempts: 1, on: [503] })
            .send();

        await vi.advanceTimersByTimeAsync(1999);
        expect(fetchImpl).toHaveBeenCalledOnce();

        await vi.advanceTimersByTimeAsync(1);
        const response = await responsePromise;

        expect(fetchImpl).toHaveBeenCalledTimes(2);
        expect(response.timing.retryEvents).toEqual([
            {
                attempt: 1,
                delayMs: 2000,
                status: 503,
            },
        ]);
    });

    it('aborts during retry delay without starting the next fetch attempt', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(0);
        const controller = new AbortController();
        const fetchImpl = vi.fn<typeof fetch>(async () => Promise.resolve(new Response('busy', { status: 503 })));
        const request = avirx('https://api.example.com', { fetch: fetchImpl })
            .signal(controller.signal)
            .get('/users')
            .retry({ attempts: 1, on: [503] })
            .result();

        await vi.advanceTimersByTimeAsync(0);
        expect(fetchImpl).toHaveBeenCalledOnce();

        controller.abort('cancelled');
        await vi.advanceTimersByTimeAsync(10);
        const result = await request;

        expect(result.ok).toBe(false);
        if (result.ok) {
            throw new Error('Expected aborted retry result.');
        }
        expect(result.error.message).toBe('Request aborted.');
        expect(fetchImpl).toHaveBeenCalledOnce();
        vi.useRealTimers();
    });

    it('does not retry non-idempotent methods by default', async () => {
        const fetchImpl = vi.fn<typeof fetch>(async () =>
            Promise.resolve(new Response('busy', { status: 503 })),
        );

        await expect(
            avirx('https://api.example.com', { fetch: fetchImpl }).post('/events').retry(1).send(),
        ).rejects.toMatchObject({
            status: 503,
        });
        expect(fetchImpl).toHaveBeenCalledOnce();
    });

    it('lets request-level retry override client retry', async () => {
        const fetchImpl = vi.fn<typeof fetch>(async () =>
            Promise.resolve(new Response('busy', { status: 503 })),
        );

        await expect(
            avirx('https://api.example.com', { fetch: fetchImpl })
                .retry(3)
                .get('/users')
                .retry(0)
                .send(),
        ).rejects.toMatchObject({
            request: {
                retry: {
                    attempts: 0,
                },
            },
            status: 503,
        });
        expect(fetchImpl).toHaveBeenCalledOnce();
    });

    it('skips retries for non-replayable bodies', async () => {
        const fetchImpl = vi.fn<typeof fetch>(async () =>
            Promise.resolve(new Response('busy', { status: 503 })),
        );

        await expect(
            avirx('https://api.example.com', { fetch: fetchImpl })
                .put('/upload')
                .body(new ReadableStream<Uint8Array>())
                .retry(1)
                .send(),
        ).rejects.toMatchObject({
            status: 503,
        });
        expect(fetchImpl).toHaveBeenCalledOnce();
    });

    it('parses JSON responses', async () => {
        const fetchImpl = vi.fn<typeof fetch>(async () =>
            Promise.resolve(new Response(JSON.stringify({ id: 'usr_123' }))),
        );

        const user = await avirx('https://api.example.com', { fetch: fetchImpl })
            .get('/users/{id}')
            .path({ id: 'usr_123' })
            .json<{ id: string }>();

        expect(user.id).toBe('usr_123');
    });

    it('returns undefined JSON data for 204 and 205 responses', async () => {
        const fetchImpl = vi.fn<typeof fetch>(async () => Promise.resolve(new Response(null, { status: 204 })));

        const data = await avirx('https://api.example.com', { fetch: fetchImpl }).delete('/users/{id}').path({
            id: 'usr_123',
        }).json();

        expect(data).toBeUndefined();
    });

    it('parses HEAD responses as empty text without reading JSON', async () => {
        const fetchImpl = vi.fn<typeof fetch>(async () => Promise.resolve(new Response(null, { status: 200 })));

        await expect(avirx('https://api.example.com', { fetch: fetchImpl }).head('/users').text()).resolves.toBe(
            '',
        );
        await expect(
            avirx('https://api.example.com', { fetch: fetchImpl }).head('/users').json(),
        ).rejects.toMatchObject({
            message: 'Failed to parse response JSON.',
        });
    });

    it('throws AvirxError for invalid JSON', async () => {
        const fetchImpl = vi.fn<typeof fetch>(async () => Promise.resolve(new Response('not-json')));
        const errors: string[] = [];

        await expect(
            avirx('https://api.example.com', { fetch: fetchImpl })
                .on('error', (context) => {
                    errors.push(context.error()?.message ?? 'missing');
                    expect(context.response()?.status).toBe(200);
                    expect(context.request().url.href).toBe('https://api.example.com/broken');
                })
                .get('/broken')
                .json(),
        ).rejects.toThrow(AvirxError);
        expect(errors).toEqual(['Failed to parse response JSON.']);

        const hookError = new Error('hook failed');
        await expect(
            avirx('https://api.example.com', { fetch: fetchImpl })
                .on('error', () => {
                    throw hookError;
                })
                .get('/broken')
                .json(),
        ).rejects.toBe(hookError);
    });

    it('parses text responses', async () => {
        const fetchImpl = vi.fn<typeof fetch>(async () => Promise.resolve(new Response('hello')));

        await expect(avirx('https://api.example.com', { fetch: fetchImpl }).get('/hello').text()).resolves.toBe(
            'hello',
        );
    });

    it('downloads blob responses with metadata while preserving the native response body', async () => {
        const fetchImpl = vi.fn<typeof fetch>(async () =>
            Promise.resolve(new Response('id,name\n1,Ada\n', {
                headers: {
                    'content-disposition': 'attachment; filename="report.csv"',
                    'content-length': '14',
                    'content-type': 'text/csv',
                },
            })),
        );

        const download = await avirx('https://api.example.com', { fetch: fetchImpl })
            .get('/exports/{id}')
            .path({ id: 'exp_123' })
            .download();

        expect(download.status).toBe(200);
        expect(download.filename).toBe('report.csv');
        expect(download.contentLength).toBe(14);
        expect(download.contentType).toBe('text/csv');
        await expect(download.blob.text()).resolves.toBe('id,name\n1,Ada\n');
        await expect(download.response.native.text()).resolves.toBe('id,name\n1,Ada\n');
    });

    it('prefers UTF-8 filename-star content disposition metadata for downloads', async () => {
        const fetchImpl = vi.fn<typeof fetch>(async () =>
            Promise.resolve(new Response('ok', {
                headers: {
                    'content-disposition': 'attachment; filename=fallback.txt; filename*=UTF-8\'\'report%20final.csv',
                    'content-length': 'invalid',
                },
            })),
        );

        const download = await avirx('https://api.example.com', { fetch: fetchImpl })
            .get('/exports/latest')
            .download();

        expect(download.filename).toBe('report final.csv');
        expect(download.contentLength).toBeUndefined();
    });

    it('parses quoted download filenames with escaped characters', async () => {
        const fetchImpl = vi.fn<typeof fetch>(async () =>
            Promise.resolve(new Response('ok', {
                headers: {
                    'content-disposition': 'attachment; filename="quarterly; \\"final\\".csv"',
                },
            })),
        );

        const download = await avirx('https://api.example.com', { fetch: fetchImpl })
            .get('/exports/latest')
            .download();

        expect(download.filename).toBe('quarterly; "final".csv');
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
