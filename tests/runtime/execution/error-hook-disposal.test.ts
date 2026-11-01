import { createServer } from 'node:http';
import { describe, expect, it } from 'vitest';
import { avirx } from 'avirx';

describe('error hook response disposal', () => {
    it.each(['send', 'result'] as const)('disposes an abandoned streaming error response for %s', async (mode) => {
        let connectionClosed = false;
        const server = createServer((_incoming, response) => {
            response.writeHead(500, { 'content-type': 'text/plain' });
            response.write('an unfinished error response');
            response.once('close', () => {
                connectionClosed = true;
            });
        });
        await new Promise<void>((resolve, reject) => {
            server.once('error', reject);
            server.listen(0, '127.0.0.1', () => {
                server.off('error', reject);
                resolve();
            });
        });
        const address = server.address();
        if (address === null || typeof address === 'string') throw new Error('Expected TCP server.');

        const failure = new Error('error hook failed');
        let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
        let closed: Promise<unknown> | undefined;
        const client = avirx(`http://127.0.0.1:${String(address.port)}`).on('error', (context) => {
            reader = context.response()?.native.body?.getReader();
            closed = reader?.closed.catch((error: unknown) => error);
            throw failure;
        });

        try {
            await expect(client.get('/open')[mode]()).rejects.toBe(failure);
            expect(reader).toBeDefined();
            await expect(reader?.read()).rejects.toMatchObject({ name: 'AbortError' });
            await expect(closed).resolves.toMatchObject({ name: 'AbortError' });
            await expect.poll(() => connectionClosed).toBe(true);
        } finally {
            reader?.releaseLock();
            server.closeAllConnections();
            await new Promise<void>((resolve, reject) => {
                server.close((error) => {
                    if (error) reject(error); else resolve();
                });
            });
        }
    });
});
