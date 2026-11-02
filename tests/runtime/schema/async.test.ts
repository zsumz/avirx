import { describe, expect, it, vi } from 'vitest';
import { avirx, parseWithSchema } from 'avirx';
import { publicResponse } from '../../helpers/public-response.js';

describe('asynchronous schemas', () => {
    it('awaits response schemas while preserving the raw parse helper output', async () => {
        const fetchImpl = vi.fn<typeof fetch>(async () => Promise.resolve(new Response('{"id":123}')));
        const schema = {
            async parse(input: unknown): Promise<{ id: string }> {
                return Promise.resolve({ id: String((input as { id: number }).id) });
            },
        };
        const api = avirx('https://api.example.com', { fetch: fetchImpl });

        expect(parseWithSchema(schema, { id: 123 })).toBeInstanceOf(Promise);
        await expect(api.get('/users').as(schema)).resolves.toEqual({ id: '123' });
        await expect(api.get('/users').result(schema)).resolves.toMatchObject({
            data: { id: '123' },
            ok: true,
        });
    });

    it('wraps rejected validation, runs error hooks, and does not cache the response', async () => {
        const cause = new TypeError('Expected a user.');
        const fetchImpl = vi.fn<typeof fetch>(async () => Promise.resolve(publicResponse('{}')));
        const errors = vi.fn();
        let rejectValidation!: (reason: unknown) => void;
        const validation: Promise<never> = new Promise((_resolve, reject) => {
            rejectValidation = reject;
        });
        const schema = { parse: vi.fn(async (): Promise<never> => validation) };
        const api = avirx('https://api.example.com', { fetch: fetchImpl })
            .cache({ ttl: '60s' })
            .on('error', errors);

        const rejection = expect(api.get('/users').as(schema)).rejects.toMatchObject({
            cause,
            message: 'Response validation failed.',
            name: 'AvirxError',
        });
        await vi.waitFor(() => {
            expect(schema.parse).toHaveBeenCalledTimes(1);
        });
        expect(api.state.cache?.size()).toBe(0);
        expect(errors).not.toHaveBeenCalled();
        rejectValidation(cause);
        await rejection;
        expect(api.state.cache?.size()).toBe(0);
        expect(errors).toHaveBeenCalledTimes(1);
        await expect(api.get('/users').result(schema)).resolves.toMatchObject({
            error: { cause, message: 'Response validation failed.' },
            ok: false,
        });
        expect(api.state.cache?.size()).toBe(0);
        await api.get('/users').json();
        expect(api.state.cache?.size()).toBe(1);
        await api.get('/users').json();
        expect(fetchImpl).toHaveBeenCalledTimes(3);
        expect(errors).toHaveBeenCalledTimes(2);
    });

    it('awaits schemas attached to unexpected status responses', async () => {
        const fetchImpl = vi.fn<typeof fetch>(async () =>
            Promise.resolve(new Response('{"code":"missing"}', { status: 404 })),
        );
        const result = await avirx('https://api.example.com', { fetch: fetchImpl })
            .get('/users')
            .error({ parse: async (input: unknown) => Promise.resolve(input as { code: string }) })
            .result();

        expect(result).toMatchObject({ error: { data: { code: 'missing' } }, ok: false });
    });
});
