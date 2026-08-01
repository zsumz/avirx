import { describe, expect, it, vi } from 'vitest';
import { avirx } from 'avirx';

describe('schema adapter', () => {
    it('wraps response validation failures in result mode', async () => {
        const cause = new TypeError('Expected user.');
        const fetchImpl = vi.fn<typeof fetch>(async () =>
            Promise.resolve(new Response(JSON.stringify({ nope: true }))),
        );
        const errors: string[] = [];
        const schema = {
            parse(): { id: string } {
                throw cause;
            },
        };

        const result = await avirx('https://api.example.com', { fetch: fetchImpl })
            .on('error', (context) => {
                errors.push(context.error()?.message ?? 'missing');
                expect(context.error()?.cause).toBe(cause);
                expect(context.response()?.status).toBe(200);
                expect(context.request().url.href).toBe('https://api.example.com/users');
            })
            .get('/users')
            .result(schema);

        expect(result.ok).toBe(false);
        if (result.ok) {
            throw new Error('Expected error result.');
        }
        expect(result.status).toBe(200);
        expect(result.response?.status).toBe(200);
        expect(result.error).toMatchObject({
            cause,
            message: 'Response validation failed.',
            status: 200,
        });
        expect(errors).toEqual(['Response validation failed.']);
    });

    it('returns transport failures in result mode', async () => {
        const cause = new Error('socket broke');
        const fetchImpl = vi.fn<typeof fetch>(async () => Promise.reject(cause));

        const result = await avirx('https://api.example.com', { fetch: fetchImpl }).get('/users').result();

        expect(result.ok).toBe(false);
        if (result.ok) {
            throw new Error('Expected error result.');
        }
        expect(result.status).toBeUndefined();
        expect(result.response).toBeUndefined();
        expect(result.error).toMatchObject({
            cause,
            message: 'Request failed.',
        });
    });
});
