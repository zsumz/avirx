import { describe, expect, it, vi } from 'vitest';
import { avirx } from 'avirx';

describe('HTTP method builders', () => {
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
