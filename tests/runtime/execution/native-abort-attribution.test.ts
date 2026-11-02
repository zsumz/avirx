import { createServer } from 'node:http';
import { describe, expect, it } from 'vitest';
import { avirx, AvirxError } from 'avirx';

describe('native abort error attribution', () => {
    it.each(['fetch', 'body'] as const)('attributes %s cancellation to the current request', async (phase) => {
        let received: () => void = () => undefined;
        const started: Promise<void> = new Promise((resolve) => {
            received = resolve;
        });
        const server = createServer((_incoming, response) => {
            if (phase === 'body') {
                response.writeHead(200, { 'content-type': 'text/plain' });
                response.write('unfinished body');
            }
            received();
        });
        await new Promise<void>((resolve, reject) => {
            server.once('error', reject);
            server.listen(0, '127.0.0.1', resolve);
        });
        const address = server.address();
        if (!address || typeof address === 'string') throw new Error('Expected TCP server.');
        const origin = `http://127.0.0.1:${String(address.port)}`;
        const siblingRequest = await avirx('https://sibling.example.com').get('/').build();
        const sibling = new AvirxError('Sibling failure.', { request: siblingRequest, status: 409 });
        const controller = new AbortController();
        let responseReceived: () => void = () => undefined;
        const headers: Promise<void> = new Promise((resolve) => {
            responseReceived = resolve;
        });
        const request = avirx(origin).get('/current').signal(controller.signal).on('response', responseReceived);

        try {
            const execution = phase === 'body' ? request.text() : request.result();
            await (phase === 'body' ? headers : started);
            controller.abort(sibling);
            const outcome = await execution.catch((error: unknown) => error);
            const error = typeof outcome === 'object' && outcome !== null && 'error' in outcome
                ? outcome.error : outcome;

            expect(error).toBeInstanceOf(AvirxError);
            expect(error).not.toBe(sibling);
            if (!(error instanceof AvirxError)) throw new Error('Expected current request error.');
            expect(error.kind).toBe('aborted');
            expect(error.cause).toBe(sibling);
            expect(error.request.url.href).toBe(`${origin}/current`);
            expect(error.status).toBe(phase === 'body' ? 200 : undefined);
        } finally {
            server.closeAllConnections();
            await new Promise<void>((resolve, reject) => server.close((error) => {
                if (error) reject(error); else resolve();
            }));
        }
    });
});
