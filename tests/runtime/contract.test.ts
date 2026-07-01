import { describe, expect, it, vi } from 'vitest';

import { avirx, endpoint } from 'avirx';

describe('client contracts', () => {
    it('executes endpoint definitions through the client', async () => {
        const fetchImpl = vi.fn<typeof fetch>(async () =>
            Promise.resolve(new Response(JSON.stringify({ id: 123, email: 'a@example.com' }))),
        );
        const ParamsSchema = {
            parse(input: unknown): { id: string } {
                return input as { id: string };
            },
        };
        const UserSchema = {
            parse(input: unknown): { id: string; email: string } {
                const value = input as { email: string; id: number | string };
                return { email: value.email, id: String(value.id) };
            },
        };
        const api = avirx('https://api.example.com', { fetch: fetchImpl }).contract({
            getUser: endpoint.get('/users/{id}').params(ParamsSchema).returns(UserSchema),
        });

        const user = await api.getUser({ path: { id: 'usr_123' } });

        expect(user).toEqual({ id: '123', email: 'a@example.com' });
        expect(fetchImpl).toHaveBeenCalledWith(
            new URL('https://api.example.com/users/usr_123'),
            expect.objectContaining({ method: 'GET' }),
        );
    });

    it('validates query and body input before executing', async () => {
        const fetchImpl = vi.fn<typeof fetch>(async () =>
            Promise.resolve(new Response(JSON.stringify({ id: 'book_123', title: 'The Left Hand of Darkness' }))),
        );
        const QuerySchema = {
            parse: vi.fn((input: unknown): { tag: readonly string[] } => input as { tag: readonly string[] }),
        };
        const BodySchema = {
            parse: vi.fn((input: unknown): { title: string } => input as { title: string }),
        };
        const BookSchema = {
            parse(input: unknown): { id: string; title: string } {
                return input as { id: string; title: string };
            },
        };
        const api = avirx('https://api.example.com', { fetch: fetchImpl }).contract({
            createBook: endpoint
                .post('/books')
                .query(QuerySchema)
                .body(BodySchema)
                .returns(BookSchema),
        });

        const book = await api.createBook({
            body: { title: 'The Left Hand of Darkness' },
            query: { tag: ['paperback', 'api'] },
        });

        expect(book).toEqual({ id: 'book_123', title: 'The Left Hand of Darkness' });
        expect(QuerySchema.parse).toHaveBeenCalledWith({ tag: ['paperback', 'api'] });
        expect(BodySchema.parse).toHaveBeenCalledWith({ title: 'The Left Hand of Darkness' });
        expect(fetchImpl).toHaveBeenCalledWith(
            new URL('https://api.example.com/books?tag=paperback&tag=api'),
            expect.objectContaining({
                body: JSON.stringify({ title: 'The Left Hand of Darkness' }),
                method: 'POST',
            }),
        );
    });

    it('does not execute when contract input validation fails', async () => {
        const cause = new TypeError('Expected query.');
        const fetchImpl = vi.fn<typeof fetch>(async () => Promise.resolve(new Response('{}')));
        const QuerySchema = {
            parse(): { tag: string } {
                throw cause;
            },
        };
        const api = avirx('https://api.example.com', { fetch: fetchImpl }).contract({
            search: endpoint.get('/search').query(QuerySchema),
        });

        await expect(api.search({ query: { tag: 'paperback' } })).rejects.toBe(cause);
        expect(fetchImpl).not.toHaveBeenCalled();
    });

    it('rejects invalid contract schema output shapes before executing', async () => {
        const fetchImpl = vi.fn<typeof fetch>(async () => Promise.resolve(new Response('{}')));
        const InvalidParamsSchema = {
            parse(): { id: { nested: true } } {
                return { id: { nested: true } };
            },
        };
        const InvalidQuerySchema = {
            parse(): { filter: { nested: string } } {
                return { filter: { nested: 'yes' } };
            },
        };
        const InvalidBodySchema = {
            parse(): () => void {
                return (): void => {
                    return;
                };
            },
        };
        const api = avirx('https://api.example.com', { fetch: fetchImpl }).contract({
            createBook: endpoint.post('/books').body(InvalidBodySchema as never),
            getBook: endpoint.get('/books/{id}').params(InvalidParamsSchema as never),
            listBooks: endpoint.get('/books'),
            search: endpoint.get('/search').query(InvalidQuerySchema as never),
        });

        await expect(api.getBook({ path: { id: 'book_123' } } as never)).rejects.toThrow(
            'Contract path param "id" must be a string, number, or boolean.',
        );
        await expect(api.search({ query: { filter: 'open' } } as never)).rejects.toThrow(
            'Contract query value "filter" must be a primitive or an array of primitives.',
        );
        await expect(api.createBook({ body: { title: 'The Left Hand of Darkness' } } as never)).rejects.toThrow(
            'Contract body schema must parse to a supported request body value.',
        );
        await expect(api.listBooks({ query: { shelf: 'featured' } } as never)).rejects.toThrow(
            'Contract endpoint "/books" does not accept query input.',
        );
        await expect(api.listBooks({ body: { title: 'The Left Hand of Darkness' } } as never)).rejects.toThrow(
            'Contract endpoint "/books" does not accept body input.',
        );
        expect(fetchImpl).not.toHaveBeenCalled();
    });

    it('supports explicit result mode for contract calls', async () => {
        const fetchImpl = vi.fn<typeof fetch>(async () =>
            Promise.resolve(new Response(JSON.stringify({ code: 'missing' }), { status: 404 })),
        );
        const ParamsSchema = {
            parse(input: unknown): { id: string } {
                return input as { id: string };
            },
        };
        const UserSchema = {
            parse(input: unknown): { id: string } {
                return input as { id: string };
            },
        };
        const api = avirx('https://api.example.com', { fetch: fetchImpl }).contract({
            getUser: endpoint.get('/users/{id}').params(ParamsSchema).returns(UserSchema),
        });

        const result = await api.getUser.result({ path: { id: 'usr_missing' } });

        expect(result).toMatchObject({
            ok: false,
            status: 404,
        });
        if (result.ok) {
            throw new Error('Expected error result.');
        }
        expect(result.error.message).toBe('Unexpected HTTP status 404.');
    });
});
