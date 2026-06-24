import { describe, expect, it } from 'vitest';

import { buildRequest } from '../../src/built-request.js';
import { createClientState, createRequestState } from '../../src/internals/model.js';
import { createAvirxResponse, parseJsonSafely, parseTextSafely } from '../../src/response.js';

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

        await expect(parseJsonSafely(response)).resolves.toEqual({ ok: true });
        await expect(parseTextSafely(response)).resolves.toBe('{"ok":true}');
    });
});
