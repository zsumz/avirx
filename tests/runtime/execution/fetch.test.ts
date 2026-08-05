import { afterEach, describe, expect, it, vi } from 'vitest';
import { avirx } from 'avirx';

describe('fetch execution', () => {
    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('executes requests with an injected fetch implementation', async () => {
        const fetchImpl = vi.fn<typeof fetch>(async () =>
            Promise.resolve(
                new Response('accepted', {
                    headers: { 'x-response': 'yes' },
                    status: 202,
                    statusText: 'Accepted',
                }),
            ),
        );

        const response = await avirx('https://api.example.com/v1', { fetch: fetchImpl })
            .post('/users/{id}?existing=1')
            .path({ id: 'usr 123' })
            .query({ tag: ['a', 'b'] })
            .header('X-Request', 'req_123')
            .body({ ok: true })
            .send();

        expect(fetchImpl).toHaveBeenCalledOnce();
        const [input, init] = fetchImpl.mock.calls[0] ?? [];
        expect(formatFetchInput(input)).toBe('https://api.example.com/v1/users/usr%20123?existing=1&tag=a&tag=b');
        expect(init).toMatchObject({
            body: '{"ok":true}',
            headers: {
                'content-type': 'application/json',
                'x-request': 'req_123',
            },
            method: 'POST',
        });
        expect(response.status).toBe(202);
        expect(response.statusText).toBe('Accepted');
        expect(response.ok).toBe(true);
        expect(response.url).toBe('https://api.example.com/v1/users/usr%20123?existing=1&tag=a&tag=b');
        expect(response.headers['x-response']).toBe('yes');
        expect(response.native).toBeInstanceOf(Response);
        expect(response.request.url.href).toBe(
            'https://api.example.com/v1/users/usr%20123?existing=1&tag=a&tag=b',
        );
        expect(response.timing.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('uses global fetch by default', async () => {
        const fetchImpl = vi.fn<typeof fetch>(async () => Promise.resolve(new Response(null, { status: 204 })));
        vi.stubGlobal('fetch', fetchImpl);

        const response = await avirx('https://api.example.com').get('/health').send();

        expect(fetchImpl).toHaveBeenCalledOnce();
        expect(formatFetchInput(fetchImpl.mock.calls[0]?.[0])).toBe('https://api.example.com/health');
        expect(response.status).toBe(204);
        expect(response.ok).toBe(true);
    });

    it('passes an AbortSignal when timeout is configured', async () => {
        const fetchImpl = vi.fn<typeof fetch>(async () => Promise.resolve(new Response('ok')));

        await avirx('https://api.example.com', { fetch: fetchImpl }).timeout('5s').get('/slow').send();

        const init = fetchImpl.mock.calls[0]?.[1];
        expect(init?.signal).toBeInstanceOf(AbortSignal);
    });

    it('marks streaming request bodies for native Node fetch', async () => {
        const fetchImpl = vi.fn<typeof fetch>(async () => Promise.resolve(new Response('ok')));
        const body: ReadableStream<Uint8Array> = new ReadableStream();

        await avirx('https://api.example.com', { fetch: fetchImpl })
            .post('/stream')
            .body(body)
            .send();

        const init = fetchImpl.mock.calls[0]?.[1] as RequestInit & { duplex?: string };
        expect(init.body).toBe(body);
        expect(init.duplex).toBe('half');
    });
});

function formatFetchInput(input: Parameters<typeof fetch>[0] | undefined): string {
    if (typeof input === 'string') {
        return input;
    }
    if (input instanceof URL) {
        return input.href;
    }
    if (input instanceof Request) {
        return input.url;
    }

    throw new TypeError('Expected fetch input to be present.');
}
