import { afterEach, describe, expect, it, vi } from 'vitest';

import { avirx } from 'avirx';

import { closeConnection, delayed, malformedJson, sequence } from '../helpers/http-simulator.js';
import { httpJson, startHttpTestServer, type HttpTestServer } from '../helpers/http-server.js';

describe('failure-mode torture tests', () => {
    let server: HttpTestServer | undefined;

    afterEach(async () => {
        await server?.close();
        server = undefined;
    });

    it('covers fetch/network failure', async () => {
        server = await startHttpTestServer();
        sequence(server, 'GET', '/closed', [closeConnection()]);

        await expect(avirx(server.origin).get('/closed').send()).rejects.toMatchObject({
            message: 'Request failed.',
        });
    });

    it('covers timeout and abort behavior', async () => {
        server = await startHttpTestServer();
        sequence(server, 'GET', '/slow', [delayed(httpJson({ ok: true }), 100)]);

        await expect(
            avirx(server.origin)
                .timeout('25ms')
                .get('/slow')
                .send(),
        ).rejects.toMatchObject({
            message: 'Request timed out.',
            request: {
                timeoutMs: 25,
            },
        });
    });

    it('covers malformed JSON', async () => {
        server = await startHttpTestServer();
        sequence(server, 'GET', '/bad-json', [malformedJson('{ nope')]);

        await expect(avirx(server.origin).get('/bad-json').json()).rejects.toMatchObject({
            message: 'Failed to parse response JSON.',
            status: 200,
        });
    });

    it('covers validation failure', async () => {
        server = await startHttpTestServer();
        const cause = new TypeError('Expected user.');
        const User = {
            parse(): { id: string } {
                throw cause;
            },
        };
        sequence(server, 'GET', '/invalid-user', [httpJson({ nope: true })]);

        await expect(avirx(server.origin).get('/invalid-user').as(User)).rejects.toMatchObject({
            cause,
            message: 'Response validation failed.',
            status: 200,
        });
    });

    it('covers error response schema success and failure', async () => {
        server = await startHttpTestServer();
        const errorSchemaCause = new TypeError('Expected API error.');
        const ApiError = {
            parse(input: unknown): { code: string; message: string } {
                if (typeof input === 'object' && input !== null && 'code' in input && 'message' in input) {
                    return input as { code: string; message: string };
                }

                throw errorSchemaCause;
            },
        };
        const User = {
            parse(input: unknown): { id: string } {
                return input as { id: string };
            },
        };
        sequence(server, 'GET', '/error-schema-ok', [
            httpJson({ code: 'missing', message: 'Missing user.' }, { status: 404 }),
        ]);
        sequence(server, 'GET', '/error-schema-bad', [
            httpJson({ nope: true }, { status: 404 }),
        ]);

        await expect(
            avirx(server.origin).get('/error-schema-ok').error(ApiError).as(User),
        ).rejects.toMatchObject({
            data: {
                code: 'missing',
                message: 'Missing user.',
            },
            message: 'Unexpected HTTP status 404.',
            status: 404,
        });

        await expect(
            avirx(server.origin).get('/error-schema-bad').error(ApiError).as(User),
        ).rejects.toMatchObject({
            cause: errorSchemaCause,
            data: undefined,
            message: 'Unexpected HTTP status 404.',
            status: 404,
        });
    });

    it('covers hook failures', async () => {
        server = await startHttpTestServer();
        const cause = new TypeError('hook failed');
        const errorHook = vi.fn();
        sequence(server, 'GET', '/hook', [httpJson({ ok: true })]);

        await expect(
            avirx(server.origin)
                .on('error', errorHook)
                .get('/hook')
                .on('request', () => {
                    throw cause;
                })
                .send(),
        ).rejects.toMatchObject({
            cause,
            message: 'Request failed.',
        });
        expect(errorHook).toHaveBeenCalledOnce();
    });

    it('covers retry exhaustion and retry success after transient failures', async () => {
        server = await startHttpTestServer();
        const exhausted = sequence(server, 'GET', '/exhausted', [
            httpJson({ code: 'try_again' }, { status: 503 }),
            httpJson({ code: 'try_again' }, { status: 503 }),
            httpJson({ code: 'try_again' }, { status: 503 }),
        ]);
        const recovered = sequence(server, 'GET', '/recovered', [
            httpJson({ code: 'try_again' }, { status: 503 }),
            httpJson({ ok: true }),
        ]);

        const exhaustedResult = await avirx(server.origin)
            .retry({ attempts: 2, on: [503] })
            .get('/exhausted')
            .result();
        const recoveredResult = await avirx(server.origin)
            .retry({ attempts: 2, on: [503] })
            .get('/recovered')
            .result();

        expect(exhaustedResult).toMatchObject({
            ok: false,
            status: 503,
        });
        expect(recoveredResult).toMatchObject({
            data: { ok: true },
            ok: true,
            status: 200,
        });
        expect(exhausted.attempts).toHaveLength(3);
        expect(recovered.attempts).toHaveLength(2);
    });

    it('covers non-replayable bodies with retry', async () => {
        server = await startHttpTestServer();
        const simulation = sequence(server, 'PUT', '/form', [
            httpJson({ code: 'try_again' }, { status: 503 }),
            httpJson({ ok: true }),
        ]);
        const body = new FormData();
        body.set('name', 'avatar');

        const result = await avirx(server.origin)
            .retry({ attempts: 2, on: [503] })
            .put('/form')
            .body(body)
            .result();

        expect(result).toMatchObject({
            ok: false,
            status: 503,
        });
        expect(simulation.attempts).toHaveLength(1);
    });

    it('covers missing path params and unexpected path params', async () => {
        const unexpectedPathParams = { extra: 'nope', id: 'usr_123' };

        await expect(avirx('https://api.example.com').get('/users/{id}').send()).rejects.toThrow(
            'Missing path param "id".',
        );
        await expect(
            avirx('https://api.example.com')
                .get('/users/{id}')
                .path(unexpectedPathParams as never)
                .send(),
        ).rejects.toThrow('Unexpected path params: extra.');
    });
});
