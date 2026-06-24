import { describe, expect, it, vi } from 'vitest';

import { AvirxError, avirx, parseWithSchema } from 'avirx';

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

    it('validates configured HTTP error bodies before throwing', async () => {
        const fetchImpl = vi.fn<typeof fetch>(async () =>
            Promise.resolve(new Response(JSON.stringify({ code: 404, message: 'missing' }), { status: 404 })),
        );
        const errorSchema = {
            parse(input: unknown): { code: string; message: string } {
                if (typeof input === 'object' && input !== null && 'code' in input && 'message' in input) {
                    return {
                        code: String(input.code),
                        message: String(input.message),
                    };
                }

                throw new TypeError('Expected error body.');
            },
        };
        const userSchema = {
            parse(input: unknown): { id: string } {
                return input as { id: string };
            },
        };

        await expect(
            avirx('https://api.example.com', { fetch: fetchImpl })
                .get('/users/{id}')
                .path({ id: 'usr_123' })
                .error(errorSchema)
                .as(userSchema),
        ).rejects.toMatchObject({
            data: {
                code: '404',
                message: 'missing',
            },
            message: 'Unexpected HTTP status 404.',
            name: 'AvirxError',
            request: {
                method: 'GET',
            },
            response: {
                status: 404,
            },
            status: 404,
        });
    });

    it('preserves error body validation failures as the cause', async () => {
        const cause = new TypeError('Expected error body.');
        const fetchImpl = vi.fn<typeof fetch>(async () =>
            Promise.resolve(new Response(JSON.stringify({ nope: true }), { status: 400 })),
        );
        const errorSchema = {
            parse(): { code: string } {
                throw cause;
            },
        };
        const userSchema = {
            parse(input: unknown): { id: string } {
                return input as { id: string };
            },
        };

        let thrown: unknown;
        try {
            await avirx('https://api.example.com', { fetch: fetchImpl })
                .get('/users')
                .error(errorSchema)
                .as(userSchema);
        } catch (error) {
            thrown = error;
        }

        expect(thrown).toBeInstanceOf(AvirxError);
        expect(thrown).toMatchObject({
            cause,
            data: undefined,
            message: 'Unexpected HTTP status 400.',
            response: {
                status: 400,
            },
            status: 400,
        });
    });

    it('returns validated data in result mode', async () => {
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

        const result = await avirx('https://api.example.com', { fetch: fetchImpl }).get('/users').result(schema);

        expect(result).toMatchObject({
            data: {
                id: '123',
            },
            ok: true,
            status: 200,
        });
    });

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
