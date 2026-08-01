import { describe, expect, it, vi } from 'vitest';
import { avirx } from 'avirx';

describe('schema adapter', () => {
    it('leaves result response bodies readable after schema parsing', async () => {
        const fetchImpl = vi.fn<typeof fetch>(async () =>
            Promise.resolve(new Response(JSON.stringify({ id: 'usr_123' }))),
        );
        const schema = {
            parse(input: unknown): { id: string } {
                return input as { id: string };
            },
        };

        const result = await avirx('https://api.example.com', { fetch: fetchImpl }).get('/users').result(schema);

        if (!result.ok) {
            throw new Error('Expected ok result.');
        }
        await expect(result.response.native.json()).resolves.toEqual({ id: 'usr_123' });
    });

    it('returns HTTP failures in result mode without throwing', async () => {
        const fetchImpl = vi.fn<typeof fetch>(async () =>
            Promise.resolve(new Response(JSON.stringify({ code: 'missing' }), { status: 404 })),
        );
        const errorSchema = {
            parse(input: unknown): { code: string } {
                if (typeof input === 'object' && input !== null && 'code' in input) {
                    return { code: String(input.code) };
                }

                throw new TypeError('Expected error body.');
            },
        };
        const userSchema = {
            parse(input: unknown): { id: string } {
                return input as { id: string };
            },
        };

        const result = await avirx('https://api.example.com', { fetch: fetchImpl })
            .get('/users')
            .error(errorSchema)
            .result(userSchema);

        expect(result.ok).toBe(false);
        if (result.ok) {
            throw new Error('Expected error result.');
        }
        expect(result.status).toBe(404);
        expect(result.response?.status).toBe(404);
        expect(result.error).toMatchObject({
            data: {
                code: 'missing',
            },
            message: 'Unexpected HTTP status 404.',
            status: 404,
        });
    });
});
