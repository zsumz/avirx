import { avirx, endpoint } from 'avirx';
import { countCalls, createProductionMockApi } from './production-mock-api.js';
import { ApiErrorSchema, BookSchema, ParamsSchema } from './production-schemas.js';
import { summarizeCancellation, summarizeUnauthorized } from './production-summaries.js';
import type { ProductionExampleSummary } from './production-types.js';

export type { ProductionExampleSummary } from './production-types.js';

export async function runProductionExample(): Promise<ProductionExampleSummary> {
    const mock = createProductionMockApi();
    let token = 'expired_token';

    const protectedApi = avirx(mock.baseUrl, { fetch: mock.fetch })
        .auth.bearer(() => token)
        .timeout('2s')
        .retry({ attempts: 2, on: [503] })
        .concurrency(2)
        .rateLimit({ requests: 100, per: '1s' });

    const unauthorized = await protectedApi
        .get('/books/{id}')
        .path({ id: 'book_123' })
        .error(ApiErrorSchema)
        .result(BookSchema);

    token = 'token_123';
    const authenticatedBook = await protectedApi
        .get('/books/{id}')
        .path({ id: 'book_123' })
        .as(BookSchema);

    const publicApi = avirx(mock.baseUrl, { fetch: mock.fetch })
        .timeout('2s')
        .concurrency(2)
        .rateLimit({ requests: 100, per: '1s' })
        .cache({ ttl: '30s' });

    const cachedBook = await publicApi
        .get('/public/books/{id}')
        .path({ id: 'book_cache' })
        .as(BookSchema);

    await publicApi
        .get('/public/books/{id}')
        .path({ id: 'book_cache' })
        .as(BookSchema);

    const cancelledController = new AbortController();
    cancelledController.abort(new Error('No longer needed.'));
    const cancellation = await protectedApi
        .get('/slow')
        .signal(cancelledController.signal)
        .result(BookSchema);

    const api = protectedApi.contract({
        getBook: endpoint
            .get('/books/{id}')
            .params(ParamsSchema)
            .returns(BookSchema),
    });
    const contractBook = await api.getBook({ path: { id: 'book_456' } });

    return {
        authenticatedBook,
        cacheFetches: countCalls(mock.calls, '/public/books/book_cache'),
        cachedBook,
        cancellation: summarizeCancellation(cancellation),
        contractBook,
        unauthorized: summarizeUnauthorized(unauthorized),
    };
}
