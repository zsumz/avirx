import { createServer } from 'node:http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { avirx } from 'avirx';

describe('response body cancellation', () => {
    let server: ReturnType<typeof createServer>;
    let origin: string;

    beforeEach(async () => {
        server = createServer((incoming, response) => {
            response.writeHead(incoming.url === '/discard' ? 503 : 200, { 'content-type': 'text/plain' });
            response.write('body started');
        });
        await new Promise<void>((resolve, reject) => {
            server.once('error', reject);
            server.listen(0, '127.0.0.1', () => {
                server.off('error', reject);
                resolve();
            });
        });
        const address = server.address();
        if (address === null || typeof address === 'string') {
            throw new TypeError('Expected a TCP server address.');
        }
        origin = `http://127.0.0.1:${String(address.port)}`;
    });

    afterEach(async () => {
        if (!server.listening) return;
        server.closeAllConnections();
        await new Promise<void>((resolve, reject) => {
            server.close((error) => {
                if (error) reject(error);
                else resolve();
            });
        });
    });

    it.each(['timeout', 'client-and-request'] as const)(
        'keeps external cancellation connected to a native body with %s',
        async (mode) => {
            const controller = new AbortController();
            const client = mode === 'client-and-request'
                ? avirx(origin).signal(new AbortController().signal)
                : avirx(origin);
            const request = client.get('/stream').signal(controller.signal);
            const response = await (mode === 'timeout' ? request.timeout('5s') : request).send();
            const body = response.native.text();
            const rejection = expect(body).rejects.toThrow('user cancelled');

            controller.abort(new Error('user cancelled'));

            await rejection;
        },
    );

    it.each(['timeout', 'client-and-request'] as const)(
        'cancels a buffered body read with %s',
        async (mode) => {
            const controller = new AbortController();
            const cause = new Error('user cancelled');
            const errorHook = vi.fn();
            const client = mode === 'client-and-request'
                ? avirx(origin).signal(new AbortController().signal)
                : avirx(origin);
            const request = client.get('/stream')
                .signal(controller.signal)
                .on('error', errorHook)
                .on('response', () => {
                    setTimeout(() => {
                        controller.abort(cause);
                    }, 0);
                });

            await expect((mode === 'timeout' ? request.timeout('5s') : request).text())
                .rejects.toMatchObject({ cause, name: 'AvirxError', status: 200 });
            expect(errorHook).toHaveBeenCalledOnce();
        },
    );

    it.each([
        { event: 'response', cloned: false },
        { event: 'response', cloned: true },
        { event: 'retry', cloned: false },
        { event: 'retry', cloned: true },
    ] as const)('aborts a discarded body after a $event hook locks it (cloned=$cloned)', async ({ event, cloned }) => {
        const cause = new Error('hook failed');
        let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
        const request = avirx(origin).retry(1).get('/discard').on(event, (context) => {
            const native = context.response()?.native;
            reader = (cloned ? native?.clone() : native)?.body?.getReader();
            throw cause;
        });

        await expect(request.send()).rejects.toBe(cause);
        expect(reader).toBeDefined();
        await expect(reader?.read()).rejects.toThrow();
    });

    it('stops the attempt timeout at headers without cancelling the response body', async () => {
        let signal: AbortSignal | null | undefined;
        const native = new Response('body');
        const fetchImpl = vi.fn<typeof fetch>(async (_input, init) => {
            signal = init?.signal;
            return Promise.resolve(native);
        });
        const response = await avirx(origin, { fetch: fetchImpl }).timeout('1ms').get('/').send();

        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(signal?.aborted).toBe(false);
        await expect(response.native.text()).resolves.toBe('body');
    });
});
