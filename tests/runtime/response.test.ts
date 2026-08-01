import { describe, expect, it } from 'vitest';

import { buildRequest } from '../../src/request/build-request.js';
import { createClientState } from '../../src/client/state/client-state.js';
import { createRequestState } from '../../src/request/state/request-state.js';
import { createAvirxResponse } from '../../src/response/create-response.js';
import { readJsonResponse, readTextResponse } from '../../src/response/read-response.js';

describe('AvirxResponse wrapper', () => {
    it('wraps the native response with stable metadata', () => {
        const request = buildRequest(
            createClientState(new URL('https://api.example.com')),
            createRequestState('GET', '/users'),
        );
        const native = new Response('ok', {
            headers: { 'x-response': 'yes' },
            status: 201,
            statusText: 'Created',
        });

        const response = createAvirxResponse(native, request, {
            durationMs: 5,
            endedAt: 15,
            startedAt: 10,
        });

        expect(response.status).toBe(201);
        expect(response.ok).toBe(true);
        expect(response.statusText).toBe('Created');
        expect(response.headers).toEqual({ 'content-type': 'text/plain;charset=UTF-8', 'x-response': 'yes' });
        expect(response.native).toBe(native);
        expect(response.request).toBe(request);
        expect(response.timing.durationMs).toBe(5);
        expect(response.url).toBe('https://api.example.com/users');
    });

    it('provides safe internal parse helpers', async () => {
        const response = new Response(JSON.stringify({ ok: true }));

        await expect(readJsonResponse(response)).resolves.toEqual({ ok: true });
        await expect(readTextResponse(response)).resolves.toBe('{"ok":true}');
    });
});
