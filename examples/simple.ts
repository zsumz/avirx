import { avirx } from 'avirx';

import { createMockApi, type ExampleBook } from './mock-api.js';

export type SimpleExampleResult = Readonly<{
    items: readonly ExampleBook[];
    status: string;
}>;

export async function runSimpleExample(): Promise<SimpleExampleResult> {
    const mock = createMockApi();

    return avirx(mock.baseUrl, { fetch: mock.fetch })
        .get('/books')
        .query({ shelf: 'featured' })
        .json<SimpleExampleResult>();
}
