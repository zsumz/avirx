import { describe, expect, it, vi } from 'vitest';
import { avirx, endpoint } from 'avirx';

describe('client contracts', () => {
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

        await expect(api.search({ query: { tag: 'fiction' } })).rejects.toBe(cause);
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
});
