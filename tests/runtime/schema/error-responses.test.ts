import { describe, expect, it, vi } from 'vitest';
import { AvirxError, avirx } from 'avirx';

describe('schema adapter', () => {
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
});
