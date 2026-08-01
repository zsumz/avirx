import { describe, expect, it, vi } from 'vitest';
import { avirx, parseWithSchema } from 'avirx';

describe('schema adapter', () => {
    it('parses with any parse-compatible schema', () => {
        const schema = {
            parse(input: unknown): { id: string } {
                if (typeof input === 'object' && input !== null && 'id' in input) {
                    return { id: String(input.id) };
                }

                throw new TypeError('Expected object with id.');
            },
        };

        expect(parseWithSchema(schema, { id: 123 })).toEqual({ id: '123' });
        expect(() => parseWithSchema(schema, null)).toThrow(TypeError);
    });

    it('validates JSON responses with .as(schema)', async () => {
        const fetchImpl = vi.fn<typeof fetch>(async () =>
            Promise.resolve(new Response(JSON.stringify({ id: 123 }))),
        );
        const schema = {
            parse(input: unknown): { id: string } {
                if (typeof input === 'object' && input !== null && 'id' in input) {
                    return { id: String(input.id) };
                }

                throw new TypeError('Expected user.');
            },
        };

        const user = await avirx('https://api.example.com', { fetch: fetchImpl })
            .get('/users/{id}')
            .path({ id: 'usr_123' })
            .as(schema);

        expect(user).toEqual({ id: '123' });
    });

    it('wraps validation failures with their cause', async () => {
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

        await expect(
            avirx('https://api.example.com', { fetch: fetchImpl })
                .on('error', (context) => {
                    errors.push(context.error()?.message ?? 'missing');
                    expect(context.error()?.cause).toBe(cause);
                    expect(context.response()?.status).toBe(200);
                    expect(context.request().url.href).toBe('https://api.example.com/users');
                })
                .get('/users')
                .as(schema),
        ).rejects.toMatchObject({
            cause,
            message: 'Response validation failed.',
            name: 'AvirxError',
            status: 200,
        });
        expect(errors).toEqual(['Response validation failed.']);
    });

    it('makes empty-body validation failures clear', async () => {
        const cause = new TypeError('Expected user.');
        const fetchImpl = vi.fn<typeof fetch>(async () => Promise.resolve(new Response(null, { status: 204 })));
        const schema = {
            parse(): { id: string } {
                throw cause;
            },
        };

        await expect(
            avirx('https://api.example.com', { fetch: fetchImpl })
                .delete('/users/{id}')
                .path({ id: 'usr_123' })
                .as(schema),
        ).rejects.toMatchObject({
            cause,
            message: 'Response validation failed for empty response body.',
            name: 'AvirxError',
            status: 204,
        });
    });
});
