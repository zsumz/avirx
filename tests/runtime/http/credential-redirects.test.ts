import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { avirx } from 'avirx';
import { httpText, startHttpTestServer, type HttpTestServer } from '../../helpers/http-server.js';

describe('credential redirect policy', () => {
    let source: HttpTestServer;
    let target: HttpTestServer;

    beforeEach(async () => {
        source = await startHttpTestServer();
        target = await startHttpTestServer();
        source.route('GET', '/redirect', () => httpText('', {
            headers: { location: target.url('/target') }, status: 302,
        }));
        target.route('GET', '/target', () => httpText('ready'));
    });

    afterEach(async () => {
        await source.close();
        await target.close();
    });

    it.each(['client', 'request'] as const)('blocks managed custom credentials on %s redirects', async (scope) => {
        const client = avirx(source.origin);
        const request = scope === 'client'
            ? client.auth.apiKey('X-CUSTOM-TOKEN', () => 'FAKE-REVIEW-KEY').get('/redirect')
            : client.get('/redirect').auth.apiKey('X-CUSTOM-TOKEN', () => 'FAKE-REVIEW-KEY');

        await expect(request.send()).rejects.toMatchObject({ name: 'AvirxError' });
        expect(source.requests).toHaveLength(1);
        expect(source.requests[0]?.headers['x-custom-token']).toBe('FAKE-REVIEW-KEY');
        expect(target.requests).toHaveLength(0);
    });

    it.each(['x-api-key', 'x-service-api-key', 'cookie', 'proxy-authorization'])(
        'blocks known directly supplied sensitive header %s', async (name) => {
            await expect(avirx(source.origin).get('/redirect').header(name, 'FAKE-SECRET').send())
                .rejects.toMatchObject({ name: 'AvirxError' });
            expect(source.requests).toHaveLength(1);
            expect(target.requests).toHaveLength(0);
        },
    );

    it('follows a trusted redirect only with the explicit inherited opt-in', async () => {
        const client = avirx(source.origin, { allowCredentialRedirects: true })
            .auth.apiKey('X-CUSTOM-TOKEN', () => 'FAKE-REVIEW-KEY')
            .header('x-derived', 'yes');

        await expect(client.get('/redirect').text()).resolves.toBe('ready');
        expect(target.requests).toHaveLength(1);
        expect(target.requests[0]?.headers['x-custom-token']).toBe('FAKE-REVIEW-KEY');
        expect(target.requests[0]?.headers['x-derived']).toBe('yes');
    });

    it('preserves native uncredentialed redirect behavior', async () => {
        await expect(avirx(source.origin).get('/redirect').text()).resolves.toBe('ready');
        expect(target.requests).toHaveLength(1);
    });

    it('preserves native cross-origin Authorization stripping', async () => {
        await expect(avirx(source.origin).auth.bearer(() => 'FAKE-BEARER').get('/redirect').text())
            .resolves.toBe('ready');
        expect(source.requests[0]?.headers.authorization).toBe('Bearer FAKE-BEARER');
        expect(target.requests).toHaveLength(1);
        expect(target.requests[0]?.headers.authorization).toBeUndefined();
    });
});
