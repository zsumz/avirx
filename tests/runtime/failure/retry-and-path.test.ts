import { afterEach, describe, expect, it } from 'vitest';
import { avirx } from 'avirx';
import { sequence } from '../../helpers/http-simulator.js';
import { httpJson, startHttpTestServer, type HttpTestServer } from '../../helpers/http-server.js';

describe('failure-mode torture tests', () => {
    let server: HttpTestServer | undefined;

    afterEach(async () => {
        await server?.close();
        server = undefined;
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
