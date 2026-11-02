import { afterEach, describe, expect, it, vi } from 'vitest';
import { avirx } from 'avirx';
import { sequence } from '../../helpers/http-simulator.js';
import { httpJson, startHttpTestServer, type HttpTestServer } from '../../helpers/http-server.js';

describe('failure-mode torture tests', () => {
    let server: HttpTestServer | undefined;

    afterEach(async () => {
        await server?.close();
        server = undefined;
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
        ).rejects.toBe(cause);
        expect(errorHook).not.toHaveBeenCalled();
    });
});
