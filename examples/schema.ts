import { avirx } from 'avirx';

import { createMockApi, type ExampleBook } from './mock-api.js';

const Book = {
    parse(input: unknown): ExampleBook {
        const value = input as ExampleBook;
        return {
            id: value.id,
            title: value.title,
        };
    },
};

export async function runSchemaExample(): Promise<ExampleBook> {
    const mock = createMockApi();

    return avirx(mock.baseUrl, { fetch: mock.fetch })
        .get('/books/{id}')
        .path({ id: 'book_123' })
        .as(Book);
}
