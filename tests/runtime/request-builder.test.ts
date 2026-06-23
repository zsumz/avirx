import { describe, expect, it, vi } from 'vitest';

import { avirx, type HttpMethod } from 'avirx';

describe('HTTP method builders', () => {
    it.each([
        ['delete', 'DELETE'],
        ['get', 'GET'],
        ['head', 'HEAD'],
        ['options', 'OPTIONS'],
        ['patch', 'PATCH'],
        ['post', 'POST'],
        ['put', 'PUT'],
    ] as const)('creates a %s request builder', (methodName, method) => {
        const client = avirx('https://api.example.com');
        const builder = client[methodName]('/users/{id}');

        expect(Object.isFrozen(builder)).toBe(true);
        expect(builder.clientState).toBe(client.state);
        expect(builder.state.method satisfies HttpMethod).toBe(method);
        expect(builder.state.route).toBe('/users/{id}');
    });

    it('preserves client-level defaults on request builders', () => {
        const client = avirx('https://api.example.com')
            .headers({ Authorization: 'Bearer token' })
            .timeout('5s');
        const builder = client.post('/events');

        expect(builder.clientState.headers).toEqual({ authorization: 'Bearer token' });
        expect(builder.clientState.timeoutMs).toBe(5000);
        expect(builder.state.headers).toEqual({});
    });

    it('forks request-level timeouts without mutating previous builders', () => {
        const builder = avirx('https://api.example.com').get('/events');
        const withTimeout = builder.timeout('250ms');
        const withoutTimeout = withTimeout.timeout(false);

        expect(builder.state.timeoutMs).toBeUndefined();
        expect(withTimeout.state.timeoutMs).toBe(250);
        expect(withoutTimeout.state.timeoutMs).toBe(false);
    });

    it('forks request-level retry policy without mutating previous builders', () => {
        const builder = avirx('https://api.example.com').get('/events');
        const withRetry = builder.retry(2);

        expect(builder.state.retry).toBeUndefined();
        expect(withRetry.state.retry).toMatchObject({
            attempts: 2,
            safeOnly: true,
        });
    });

    it('forks request-level hooks without mutating previous builders', () => {
        const builder = avirx('https://api.example.com').get('/events');
        const handler = (): void => {
            return;
        };
        const withHook = builder.on('response', handler);

        expect(builder.state.hooks).toBeUndefined();
        expect(withHook.state.hooks?.response).toEqual([handler]);
        expect(Object.isFrozen(withHook.state.hooks)).toBe(true);
    });

    it('forks request-level bearer auth without mutating previous builders', () => {
        const builder = avirx('https://api.example.com')
            .auth.bearer(() => 'client-token')
            .get('/events');
        const withAuth = builder.auth.bearer(() => 'request-token');

        expect(builder.state.auth).toBeUndefined();
        expect(withAuth.state.auth).toEqual({
            kind: 'bearer',
            token: '[redacted]',
        });
        expect(withAuth.clientState.auth).toEqual({
            kind: 'bearer',
            token: '[redacted]',
        });
    });

    it('redacts request-level auth state without changing execution auth', async () => {
        const fetchImpl = vi.fn<typeof fetch>(async () => Promise.resolve(new Response('ok')));
        const builder = avirx('https://api.example.com', { fetch: fetchImpl })
            .auth.basic('client', 'client-password')
            .post('/events')
            .auth.apiKey('X-Request-Key', () => 'request-secret');

        expect(builder.clientState.auth).toEqual({
            kind: 'basic',
            password: '[redacted]',
            username: 'client',
        });
        expect(builder.state.auth).toEqual({
            key: '[redacted]',
            kind: 'api-key-header',
            name: 'X-Request-Key',
        });
        expect(JSON.stringify(builder.clientState.auth)).not.toContain('client-password');
        expect(JSON.stringify(builder.state.auth)).not.toContain('request-secret');

        await builder.send();

        expect(fetchImpl).toHaveBeenCalledWith(
            new URL('https://api.example.com/events'),
            expect.objectContaining({
                headers: {
                    'x-request-key': 'request-secret',
                },
            }),
        );
    });

    it('forks request-level headers without mutating previous builders', () => {
        const builder = avirx('https://api.example.com').post('/events');
        const withHeaders = builder
            .header('Accept', 'application/json')
            .headers({ 'X-Request': 'req_123' });

        expect(builder.state.headers).toEqual({});
        expect(withHeaders.state.headers).toEqual({
            accept: 'application/json',
            'x-request': 'req_123',
        });
        expect(Object.isFrozen(withHeaders.state.headers)).toBe(true);
    });

    it('keeps request headers separate so they can override client headers', () => {
        const builder = avirx('https://api.example.com')
            .header('Accept', 'application/json')
            .get('/users')
            .header('Accept', 'text/plain');

        expect(builder.clientState.headers).toEqual({ accept: 'application/json' });
        expect(builder.state.headers).toEqual({ accept: 'text/plain' });
    });

    it('builds inspectable requests without executing fetch', async () => {
        const fetchImpl = vi.fn<typeof fetch>(async () => Promise.resolve(new Response('unused')));
        const token = vi.fn(() => 'secret-token');

        const built = await avirx('https://api.example.com/v1', { fetch: fetchImpl })
            .auth.query('api_key', token)
            .headers({ Authorization: 'Bearer client-token' })
            .timeout('5s')
            .retry({ attempts: 2, on: [503] })
            .post('/events/{id}?existing=1')
            .path({ id: 'evt 123' })
            .query({ tag: ['a', 'b'] })
            .header('X-Request', 'req_123')
            .body({ ok: true })
            .build();

        expect(fetchImpl).not.toHaveBeenCalled();
        expect(token).toHaveBeenCalledOnce();
        expect(built.method).toBe('POST');
        expect(built.url.href).toBe(
            'https://api.example.com/v1/events/evt%20123?existing=1&api_key=secret-token&tag=a&tag=b',
        );
        expect(built.redactedUrl.href).toBe(
            'https://api.example.com/v1/events/evt%20123?existing=1&api_key=%5Bredacted%5D&tag=a&tag=b',
        );
        expect(built.headers).toEqual({
            authorization: 'Bearer client-token',
            'content-type': 'application/json',
            'x-request': 'req_123',
        });
        expect(built.redactedHeaders.authorization).toBe('[redacted]');
        expect(built.body).toBe('{"ok":true}');
        expect(built.bodyMetadata).toMatchObject({
            contentLength: 11,
            contentType: 'application/json',
            kind: 'json',
        });
        expect(built.timeoutMs).toBe(5000);
        expect(built.retry).toEqual({
            attempts: 2,
            on: [503],
            safeOnly: true,
        });
        expect(Object.isFrozen(built)).toBe(true);
    });

    it('exposes built request URL snapshots', async () => {
        const built = await avirx('https://api.example.com')
            .auth.query('api_key', () => 'secret-key')
            .get('/events')
            .build();
        const url = built.url;
        const redactedUrl = built.redactedUrl;

        url.pathname = '/rewritten';
        redactedUrl.pathname = '/rewritten-redacted';

        expect(built.url.href).toBe('https://api.example.com/events?api_key=secret-key');
        expect(built.redactedUrl.href).toBe(
            'https://api.example.com/events?api_key=%5Bredacted%5D',
        );
    });

    it('generates stable redacted curl by default', async () => {
        const curl = await avirx('https://api.example.com')
            .auth.query('api_key', () => 'secret-key')
            .post('/events')
            .headers({ 'X-Request': 'req_123', Authorization: 'Bearer token' })
            .body({ ok: true })
            .curl();

        expect(curl).toBe(
            [
                'curl -X POST \'https://api.example.com/events?api_key=%5Bredacted%5D\'',
                '  -H \'authorization: [redacted]\'',
                '  -H \'content-type: application/json\'',
                '  -H \'x-request: req_123\'',
                '  -d \'{"ok":true}\'',
            ].join(' \\\n'),
        );
    });

    it('serializes URLSearchParams bodies in curl output', async () => {
        const body = new URLSearchParams([
            ['tag', 'a'],
            ['tag', 'b'],
            ['q', 'hello world'],
        ]);

        const curl = await avirx('https://api.example.com')
            .post('/events')
            .body(body)
            .curl();

        expect(curl).toBe(
            [
                'curl -X POST \'https://api.example.com/events\'',
                '  -d \'tag=a&tag=b&q=hello+world\'',
            ].join(' \\\n'),
        );
    });

    it('serializes text bodies in curl output', async () => {
        const curl = await avirx('https://api.example.com')
            .post('/events')
            .body('hello \'world\'')
            .curl();

        expect(curl).toBe(
            [
                'curl -X POST \'https://api.example.com/events\'',
                '  -d \'hello \'\\\'\'world\'\\\'\'\'',
            ].join(' \\\n'),
        );
    });

    it('documents omitted FormData bodies in curl output', async () => {
        const body = new FormData();
        body.set('name', 'avatar');

        const curl = await avirx('https://api.example.com')
            .post('/events')
            .body(body)
            .curl();

        expect(curl).toBe(
            [
                'curl -X POST \'https://api.example.com/events\'',
                '# Avirx omitted a FormData body because curl output cannot faithfully represent',
                '# runtime multipart boundaries.',
            ].join('\n'),
        );
    });

    it('documents omitted binary bodies in curl output', async () => {
        const curl = await avirx('https://api.example.com')
            .post('/events')
            .body(new ArrayBuffer(3))
            .curl();

        expect(curl).toBe(
            [
                'curl -X POST \'https://api.example.com/events\'',
                '# Avirx omitted a binary body (3 bytes).',
                '# Attach an equivalent file manually with --data-binary @file.',
            ].join('\n'),
        );
    });

    it('documents omitted stream bodies in curl output without consuming them', async () => {
        const body: ReadableStream<Uint8Array> = new ReadableStream();

        const curl = await avirx('https://api.example.com')
            .post('/events')
            .body(body)
            .curl();

        expect(curl).toBe(
            [
                'curl -X POST \'https://api.example.com/events\'',
                '# Avirx omitted a stream body because curl output cannot inspect it without consuming the stream.',
            ].join('\n'),
        );
    });

    it('generates unredacted curl only when explicitly requested', async () => {
        const curl = await avirx('https://api.example.com')
            .auth.apiKey('X-Api-Key', () => 'secret-key')
            .get('/events')
            .curl({ redacted: false });

        expect(curl).toBe(
            [
                'curl -X GET \'https://api.example.com/events\'',
                '  -H \'x-api-key: secret-key\'',
            ].join(' \\\n'),
        );
    });

    it.each(['X-Auth-Token', 'Private-Token', 'X-Custom-Key'] as const)(
        'redacts auth-created custom API key header %s',
        async (headerName) => {
            const api = avirx('https://api.example.com')
                .auth.apiKey(headerName, () => 'secret-key');
            const normalizedHeaderName = headerName.toLowerCase();

            const built = await api.get('/events').build();
            const preview = await api.get('/events').preview();
            const curl = await api.get('/events').curl();

            expect(built.headers[normalizedHeaderName]).toBe('secret-key');
            expect(built.redactedHeaders[normalizedHeaderName]).toBe('[redacted]');
            expect(built.sensitiveHeaders).toEqual([normalizedHeaderName]);
            expect(preview.headers[normalizedHeaderName]).toBe('[redacted]');
            expect(preview.redactions.headers[normalizedHeaderName]).toBe('[redacted]');
            expect(curl).toContain(`-H '${normalizedHeaderName}: [redacted]'`);
            expect(curl).not.toContain('secret-key');
        },
    );

    it('keeps auth-created custom API key headers unredacted only by explicit curl request', async () => {
        const curl = await avirx('https://api.example.com')
            .auth.apiKey('X-Auth-Token', () => 'secret-key')
            .get('/events')
            .curl({ redacted: false });

        expect(curl).toContain('-H \'x-auth-token: secret-key\'');
    });

    it('previews requests without executing fetch', async () => {
        const fetchImpl = vi.fn<typeof fetch>(async () => Promise.resolve(new Response('unused')));

        const preview = await avirx('https://api.example.com', { fetch: fetchImpl })
            .auth.query('api_key', () => 'secret-key')
            .post('/events')
            .headers({ Authorization: 'Bearer token' })
            .body({ ok: true })
            .preview();

        expect(fetchImpl).not.toHaveBeenCalled();
        expect(preview).toEqual({
            body: '{"ok":true}',
            curl: [
                'curl -X POST \'https://api.example.com/events?api_key=%5Bredacted%5D\'',
                '  -H \'authorization: [redacted]\'',
                '  -H \'content-type: application/json\'',
                '  -d \'{"ok":true}\'',
            ].join(' \\\n'),
            headers: {
                authorization: '[redacted]',
                'content-type': 'application/json',
            },
            method: 'POST',
            redactions: {
                headers: {
                    authorization: '[redacted]',
                    'content-type': 'application/json',
                },
                url: 'https://api.example.com/events?api_key=%5Bredacted%5D',
            },
            url: 'https://api.example.com/events?api_key=%5Bredacted%5D',
        });
        expect(Object.isFrozen(preview)).toBe(true);
    });

    it('rejects undefined request header values', () => {
        const builder = avirx('https://api.example.com').post('/events');

        expect(() => builder.headers({ 'x-request': undefined } as never)).toThrow(TypeError);
        expect(() => builder.header('x-request', undefined as never)).toThrow(TypeError);
    });

    it('forks query values without mutating previous builders', () => {
        const builder = avirx('https://api.example.com').get('/events');
        const withQuery = builder.query({ limit: 10, tag: ['a', 'b'], unused: undefined });

        expect(builder.state.query).toEqual({});
        expect(withQuery.state.query).toEqual({ limit: 10, tag: ['a', 'b'] });
        expect(Object.isFrozen(withQuery.state.query)).toBe(true);
    });

    it('copies query arrays so caller mutations cannot affect request state', () => {
        const tags = ['a', 'b'];
        const builder = avirx('https://api.example.com').get('/events').query({ tag: tags });

        tags.push('c');

        expect(builder.state.query).toEqual({ tag: ['a', 'b'] });
    });

    it('lets later query calls replace the same key while retaining other keys', () => {
        const builder = avirx('https://api.example.com')
            .get('/events')
            .query({ limit: 10, tag: ['a'] })
            .query({ tag: ['b'] });

        expect(builder.state.query).toEqual({ limit: 10, tag: ['b'] });
    });

    it('accepts URLSearchParams query input', () => {
        const params = new URLSearchParams();
        params.append('tag', 'a');
        params.append('tag', 'b');

        const builder = avirx('https://api.example.com').get('/events').query(params);

        expect(builder.state.query).toEqual({ tag: ['a', 'b'] });
    });

    it('forks path params without mutating previous builders', () => {
        const builder = avirx('https://api.example.com').get('/workspaces/{workspaceId}');
        const withPath = builder.path({ workspaceId: 'wrk_123' });

        expect(builder.state.pathParams).toEqual({});
        expect(withPath.state.pathParams).toEqual({ workspaceId: 'wrk_123' });
        expect(Object.isFrozen(withPath.state.pathParams)).toBe(true);
    });

    it('serializes plain object bodies to JSON and sets content type when absent', () => {
        const builder = avirx('https://api.example.com').post('/events').body({ ok: true });

        expect(builder.state.body).toBe('{"ok":true}');
        expect(builder.state.bodyMetadata).toMatchObject({
            contentLength: 11,
            contentType: 'application/json',
            kind: 'json',
        });
        expect(builder.state.headers).toEqual({ 'content-type': 'application/json' });
    });

    it('respects explicit request content type for JSON bodies', () => {
        const builder = avirx('https://api.example.com')
            .post('/events')
            .header('Content-Type', 'application/vnd.api+json')
            .body({ ok: true });

        expect(builder.state.body).toBe('{"ok":true}');
        expect(builder.state.headers).toEqual({ 'content-type': 'application/vnd.api+json' });
    });

    it('respects explicit client content type for JSON bodies', () => {
        const builder = avirx('https://api.example.com')
            .header('Content-Type', 'application/problem+json')
            .post('/events')
            .body({ ok: true });

        expect(builder.state.body).toBe('{"ok":true}');
        expect(builder.clientState.headers).toEqual({ 'content-type': 'application/problem+json' });
        expect(builder.state.headers).toEqual({});
    });

    it('omits body(undefined)', () => {
        const builder = avirx('https://api.example.com').post('/events').body(undefined);

        expect('body' in builder.state).toBe(false);
        expect(builder.state.bodyMetadata).toEqual({ kind: 'none' });
        expect(builder.state.headers).toEqual({});
    });

    it('clears a previous JSON body with body(undefined)', async () => {
        const builder = avirx('https://api.example.com')
            .post('/events')
            .body({ ok: true })
            .body(undefined);

        expect('body' in builder.state).toBe(false);
        expect(builder.state.bodyMetadata).toEqual({ kind: 'none' });

        const built = await builder.build();

        expect('body' in built).toBe(false);
        expect(built.bodyMetadata).toEqual({ kind: 'none' });
    });

    it('clears a previous multipart body with body(undefined)', async () => {
        const builder = avirx('https://api.example.com')
            .post('/avatars')
            .multipart()
            .field('userId', 'usr_123')
            .body(undefined);

        expect('body' in builder.state).toBe(false);
        expect(builder.state.bodyMetadata).toEqual({ kind: 'none' });

        const built = await builder.build();

        expect('body' in built).toBe(false);
        expect(built.bodyMetadata).toEqual({ kind: 'none' });
    });

    it('passes through non-JSON body values safely', () => {
        const builder = avirx('https://api.example.com').post('/events').body('hello');

        expect(builder.state.body).toBe('hello');
        expect(builder.state.bodyMetadata).toMatchObject({ contentLength: 5, kind: 'text' });
        expect(builder.state.headers).toEqual({});
    });

    it('snapshots URLSearchParams body values', () => {
        const params = new URLSearchParams({ tag: 'a' });
        const builder = avirx('https://api.example.com').post('/events').body(params);

        params.append('tag', 'b');

        expect(builder.state.body).toBeInstanceOf(URLSearchParams);
        expect(builder.state.body).not.toBe(params);
        expect((builder.state.body as URLSearchParams).getAll('tag')).toEqual(['a']);
        expect(builder.state.bodyMetadata).toMatchObject({ kind: 'url-search-params' });
    });

    it('snapshots ArrayBuffer body values', () => {
        const buffer = new Uint8Array([1, 2, 3]).buffer;
        const builder = avirx('https://api.example.com').post('/events').body(buffer);

        new Uint8Array(buffer)[0] = 9;

        expect(builder.state.body).toBeInstanceOf(ArrayBuffer);
        expect(builder.state.body).not.toBe(buffer);
        expect([...new Uint8Array(builder.state.body as ArrayBuffer)]).toEqual([1, 2, 3]);
        expect(builder.state.bodyMetadata).toMatchObject({ contentLength: 3, kind: 'binary' });
    });

    it('snapshots FormData body values', () => {
        const form = new FormData();
        form.append('name', 'original');

        const builder = avirx('https://api.example.com').post('/events').body(form);
        form.append('name', 'changed');

        expect(builder.state.body).toBeInstanceOf(FormData);
        expect(builder.state.body).not.toBe(form);
        expect((builder.state.body as FormData).getAll('name')).toEqual(['original']);
        expect(builder.state.bodyMetadata).toEqual({ kind: 'form' });
    });

    it('preserves null bodies as explicit empty bodies', () => {
        const builder = avirx('https://api.example.com').post('/events').body(null);

        expect('body' in builder.state).toBe(true);
        expect(builder.state.body).toBeNull();
        expect(builder.state.bodyMetadata).toEqual({ kind: 'none' });
        expect(builder.state.headers).toEqual({});
    });

    it('builds immutable multipart bodies with fields and files', async () => {
        const file = new Blob(['avatar'], { type: 'image/png' });
        const builder = avirx('https://api.example.com')
            .post('/avatars')
            .multipart();
        const withField = builder.field('userId', 'usr_123');
        const withFile = withField.file('avatar', file, 'avatar.png');

        expect(builder.state.body).toBeInstanceOf(FormData);
        expect(builder.state.bodyMetadata).toEqual({ kind: 'form' });
        expect(builder.state.headers).toEqual({});
        expect((builder.state.body as FormData).get('userId')).toBeNull();
        expect((withField.state.body as FormData).get('userId')).toBe('usr_123');
        expect((withFile.state.body as FormData).get('userId')).toBe('usr_123');
        const avatar = (withFile.state.body as FormData).get('avatar');

        expect(avatar).toBeInstanceOf(File);
        expect((avatar as File).name).toBe('avatar.png');
        expect((avatar as File).type).toBe('image/png');
        expect(Object.isFrozen(builder)).toBe(true);
        expect(Object.isFrozen(withField)).toBe(true);
        expect(Object.isFrozen(withFile)).toBe(true);

        const built = await withFile.build();

        expect(built.body).toBeInstanceOf(FormData);
        expect(built.bodyMetadata).toEqual({ kind: 'form' });
        expect(built.headers).toEqual({});
    });

    it('passes multipart bodies through fetch without setting content type', async () => {
        let body: BodyInit | null | undefined;
        let headers: HeadersInit | undefined;
        const fetchImpl = vi.fn<typeof fetch>(async (_input, init) => {
            body = init?.body;
            headers = init?.headers;
            return Promise.resolve(new Response(JSON.stringify({ ok: true }), {
                headers: { 'content-type': 'application/json' },
            }));
        });

        await avirx('https://api.example.com', { fetch: fetchImpl })
            .post('/avatars')
            .multipart()
            .field('userId', 123)
            .field('active', true)
            .file('avatar', new Blob(['avatar']))
            .json();

        expect(fetchImpl).toHaveBeenCalledOnce();
        expect(body).toBeInstanceOf(FormData);
        expect((body as FormData).get('userId')).toBe('123');
        expect((body as FormData).get('active')).toBe('true');
        expect((body as FormData).get('avatar')).toBeInstanceOf(File);
        expect(new Headers(headers).has('content-type')).toBe(false);
    });

    it('rejects bodies on GET and HEAD requests at runtime', () => {
        const getBuilder = avirx('https://api.example.com').get('/events');
        const headBuilder = avirx('https://api.example.com').head('/events');

        expect(() => (getBuilder as never as { body(body: unknown): unknown }).body({ ok: true })).toThrow(
            TypeError,
        );
        expect(() => (headBuilder as never as { body(body: unknown): unknown }).body({ ok: true })).toThrow(
            TypeError,
        );
        expect(() => (getBuilder as never as { multipart(): unknown }).multipart()).toThrow(TypeError);
        expect(() => (headBuilder as never as { multipart(): unknown }).multipart()).toThrow(TypeError);
    });

    it('forks expected status values without mutating previous builders', () => {
        const builder = avirx('https://api.example.com').post('/events');
        const single = builder.expect(204);
        const multiple = builder.expect([200, 201]);

        expect(builder.state.expectedStatuses.size).toBe(0);
        expect([...single.state.expectedStatuses]).toEqual([204]);
        expect([...multiple.state.expectedStatuses]).toEqual([200, 201]);
        expect(Object.isFrozen(single.state.expectedStatuses)).toBe(true);
        expect('add' in single.state.expectedStatuses).toBe(false);
        expect(() => (single.state.expectedStatuses as unknown as Set<number>).add(500)).toThrow(TypeError);
        expect([...single.state.expectedStatuses]).toEqual([204]);
    });

    it('rejects invalid expected status values', () => {
        const builder = avirx('https://api.example.com').post('/events');

        expect(() => builder.expect([])).toThrow(TypeError);
        expect(() => builder.expect(99)).toThrow(TypeError);
        expect(() => builder.expect(600)).toThrow(TypeError);
        expect(() => builder.expect(200.5)).toThrow(TypeError);
    });
});
