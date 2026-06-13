import { avirx, endpoint } from 'avirx';

import { createMockApi, type ExampleBook } from './mock-api.js';

const Params = {
    parse(input: unknown): { id: string } {
        return input as { id: string };
    },
};

const Book = {
    parse(input: unknown): ExampleBook {
        return input as ExampleBook;
    },
};

export async function runContractExample(): Promise<ExampleBook> {
    const mock = createMockApi();
    const api = avirx(mock.baseUrl, { fetch: mock.fetch }).contract({
        getBook: endpoint.get('/books/{id}').params(Params).returns(Book),
    });

    return api.getBook({ path: { id: 'book_456' } });
}
