import { avirx } from 'avirx';
import { z } from 'zod';

import { createMockApi } from './mock-api.js';

const Book = z.object({
    id: z.string(),
    title: z.string(),
});

const ApiError = z.object({
    code: z.string(),
    message: z.string().optional(),
});

export async function runZodExample(): Promise<z.infer<typeof Book>> {
    const mock = createMockApi();

    return avirx(mock.baseUrl, { fetch: mock.fetch })
        .get('/books/{id}')
        .path({ id: 'book_123' })
        .as(Book);
}

export async function runZodResultExample(): Promise<{
    errorCode?: string;
    ok: boolean;
    status?: number;
}> {
    const mock = createMockApi();
    const result = await avirx(mock.baseUrl, { fetch: mock.fetch })
        .get('/books/{id}')
        .path({ id: 'missing' })
        .error(ApiError)
        .result(Book);

    if (result.ok) {
        return { ok: true, status: result.status };
    }

    const output: {
        errorCode?: string;
        ok: boolean;
        status?: number;
    } = {
        ok: false,
    };

    if (result.error.data?.code !== undefined) {
        output.errorCode = result.error.data.code;
    }

    if (result.status !== undefined) {
        output.status = result.status;
    }

    return output;
}
