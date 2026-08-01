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
            query: { tag: ['fiction', 'paperback'] },
        });

        expect(book).toEqual({ id: 'book_123', title: 'The Left Hand of Darkness' });
        expect(QuerySchema.parse).toHaveBeenCalledWith({ tag: ['fiction', 'paperback'] });
        expect(BodySchema.parse).toHaveBeenCalledWith({ title: 'The Left Hand of Darkness' });
        expect(fetchImpl).toHaveBeenCalledWith(
            new URL('https://api.example.com/books?tag=fiction&tag=paperback'),
            expect.objectContaining({
                body: JSON.stringify({ title: 'The Left Hand of Darkness' }),
                method: 'POST',
            }),
        );
    });
});
