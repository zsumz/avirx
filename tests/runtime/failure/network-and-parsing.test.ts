import { afterEach, describe, expect, it } from 'vitest';
import { avirx } from 'avirx';
import { closeConnection, delayed, malformedJson, sequence } from '../../helpers/http-simulator.js';
import { httpJson, startHttpTestServer, type HttpTestServer } from '../../helpers/http-server.js';

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
});
