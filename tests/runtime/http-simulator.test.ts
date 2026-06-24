import { afterEach, describe, expect, it } from 'vitest';

import { avirx } from 'avirx';

import { closeConnection, delayed, malformedJson, sequence } from '../helpers/http-simulator.js';
import { httpJson, startHttpTestServer, type HttpTestServer } from '../helpers/http-server.js';

describe('HTTP failure simulator', () => {
    let server: HttpTestServer | undefined;

    afterEach(async () => {
        await server?.close();
        server = undefined;
    });

    it('delays responses before headers are sent for timeout tests', async () => {
        server = await startHttpTestServer();
        const simulation = sequence(server, 'GET', '/slow', [
            delayed(httpJson({ ok: true }), 1000),
        ]);

        const request = avirx(server.origin)
            .timeout('250ms')
            .get('/slow')
            .send();
        const rejection = request.then(
            () => {
                throw new Error('Expected request to time out.');
            },
            (error: unknown) => error,
        );

        await simulation.waitForAttempts(1);
        await expect(rejection).resolves.toMatchObject({
            message: 'Request timed out.',
        });

        expect(simulation.attempts).toHaveLength(1);
        expect(simulation.attempts[0]?.receivedAt).toEqual(expect.any(Number));
    });

    it('returns malformed JSON deterministically', async () => {
        server = await startHttpTestServer();
        sequence(server, 'GET', '/malformed', [
            malformedJson('{ nope'),
        ]);

        await expect(avirx(server.origin).get('/malformed').json()).rejects.toMatchObject({
            message: 'Failed to parse response JSON.',
            status: 200,
        });
    });

    it('can close the connection to simulate network failure', async () => {
        server = await startHttpTestServer();
        sequence(server, 'GET', '/closed', [
            closeConnection(),
        ]);

        await expect(avirx(server.origin).get('/closed').send()).rejects.toMatchObject({
            message: 'Request failed.',
        });
    });

    it('sequences responses for retry tests and records attempt timestamps', async () => {
        server = await startHttpTestServer();
        const simulation = sequence(server, 'GET', '/flaky', [
            httpJson({ code: 'try_again' }, { status: 503 }),
            httpJson({ code: 'try_again' }, { status: 503 }),
            httpJson({ ok: true }),
        ]);

        const result = await avirx(server.origin)
            .retry({ attempts: 2, on: [503] })
            .get('/flaky')
            .result();

        expect(result).toMatchObject({
            data: { ok: true },
            ok: true,
            status: 200,
        });
        expect(simulation.attempts).toHaveLength(3);
        const [first, second, third] = simulation.attempts;
        if (!first || !second || !third) {
            throw new Error('Expected three recorded attempts.');
        }

        expect([first.receivedAt, second.receivedAt, third.receivedAt]).toEqual([
            expect.any(Number),
            expect.any(Number),
            expect.any(Number),
        ]);
        expect(second.receivedAt).toBeGreaterThanOrEqual(first.receivedAt);
        expect(third.receivedAt).toBeGreaterThanOrEqual(second.receivedAt);
    });
});
