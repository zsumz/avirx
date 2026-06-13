import { avirx, type AvirxResult } from 'avirx';

import { createMockApi, type ExampleBook } from './mock-api.js';

const Book = {
    parse(input: unknown): ExampleBook {
        return input as ExampleBook;
    },
};

export async function runResultExample(): Promise<AvirxResult<ExampleBook>> {
    const mock = createMockApi();

    return avirx(mock.baseUrl, { fetch: mock.fetch })
        .get('/books/{id}')
        .path({ id: 'missing' })
        .result(Book);
}
