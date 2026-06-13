import { avirx } from 'avirx';

import { createMockApi } from './mock-api.js';

export async function runCurlExample(): Promise<string> {
    const mock = createMockApi();

    return avirx(mock.baseUrl, { fetch: mock.fetch })
        .post('/books')
        .body({ title: 'The Left Hand of Darkness' })
        .curl();
}
