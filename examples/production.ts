import { avirx, endpoint, type AvirxResult } from 'avirx';

type Book = Readonly<{
    id: string;
    title: string;
}>;

type ApiError = Readonly<{
    code: string;
    message: string;
}>;

export type ProductionExampleSummary = Readonly<{
    authenticatedBook: Book;
    cacheFetches: number;
    cachedBook: Book;
    cancellation: Readonly<{
        message: string;
        ok: false;
    }>;
    contractBook: Book;
    unauthorized: Readonly<{
        code: string;
        ok: false;
        status: number;
    }>;
}>;

type ExampleCall = Readonly<{
    authorization?: string;
    method: string;
    url: string;
}>;

const BookSchema = {
    parse(input: unknown): Book {
        const value = assertRecord(input);
        return {
            id: assertString(value.id, 'book.id'),
            title: assertString(value.title, 'book.title'),
        };
    },
};

const ApiErrorSchema = {
    parse(input: unknown): ApiError {
        const value = assertRecord(input);
        return {
            code: assertString(value.code, 'error.code'),
            message: assertString(value.message, 'error.message'),
        };
    },
};

const ParamsSchema = {
    parse(input: unknown): { id: string } {
        const value = assertRecord(input);
        return { id: assertString(value.id, 'params.id') };
    },
};

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

    const unauthorizedSummary = summarizeUnauthorized(unauthorized);

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
    const cancellationResult = await protectedApi
        .get('/slow')
        .signal(cancelledController.signal)
        .result(BookSchema);

    const api = protectedApi.contract({
        getBook: endpoint
            .get('/books/{id}')
            .params(ParamsSchema)
            .returns(BookSchema),
    });

    const contractBook = await api.getBook({
        path: { id: 'book_456' },
    });

    return {
        authenticatedBook,
        cacheFetches: countCalls(mock.calls, '/public/books/book_cache'),
        cachedBook,
        cancellation: summarizeCancellation(cancellationResult),
        contractBook,
        unauthorized: unauthorizedSummary,
    };
}

function createProductionMockApi(): {
    baseUrl: string;
    calls: ExampleCall[];
    fetch: typeof fetch;
} {
    const baseUrl = 'https://api.example.test';
    const calls: ExampleCall[] = [];

    const fetchImpl: typeof fetch = async (input, init) => {
        const url = toUrl(input);
        const headers = new Headers(init?.headers);
        const authorization = headers.get('authorization') ?? undefined;
        const method = init?.method ?? (input instanceof Request ? input.method : 'GET');
        calls.push(Object.freeze({
            ...authorization === undefined ? {} : { authorization },
            method,
            url: url.href,
        }));

        if (url.pathname === '/slow') {
            return Promise.resolve(jsonResponse({ id: 'slow', title: 'Slow response' }));
        }

        if (method === 'GET' && url.pathname === '/public/books/book_cache') {
            return Promise.resolve(jsonResponse({ id: 'book_cache', title: 'A Wizard of Earthsea' }));
        }

        if (method === 'GET' && url.pathname.startsWith('/books/')) {
            if (authorization !== 'Bearer token_123') {
                return Promise.resolve(
                    jsonResponse(
                        { code: 'unauthorized', message: 'Token expired.' },
                        { status: 401 },
                    ),
                );
            }

            const id = url.pathname.slice('/books/'.length);
            return Promise.resolve(jsonResponse({
                id,
                title: id === 'book_456' ? 'Pattern Recognition' : 'The Left Hand of Darkness',
            }));
        }

        return Promise.resolve(jsonResponse({ code: 'not_found', message: 'Missing route.' }, { status: 404 }));
    };

    return {
        baseUrl,
        calls,
        fetch: fetchImpl,
    };
}

function summarizeUnauthorized(result: AvirxResult<Book, ApiError>): ProductionExampleSummary['unauthorized'] {
    if (result.ok || result.status !== 401 || result.error.data === undefined) {
        throw new Error('Expected an unauthorized result.');
    }

    return {
        code: result.error.data.code,
        ok: false,
        status: result.status,
    };
}

function summarizeCancellation(result: AvirxResult<Book>): ProductionExampleSummary['cancellation'] {
    if (result.ok) {
        throw new Error('Expected a cancellation result.');
    }

    return {
        message: result.error.message,
        ok: false,
    };
}

function countCalls(calls: readonly ExampleCall[], path: string): number {
    return calls.filter((call) => new URL(call.url).pathname === path).length;
}

function jsonResponse(data: unknown, init: ResponseInit = {}): Response {
    const headers = new Headers(init.headers);
    if (!headers.has('content-type')) {
        headers.set('content-type', 'application/json');
    }

    return new Response(JSON.stringify(data), {
        ...init,
        headers,
    });
}

function toUrl(input: Parameters<typeof fetch>[0]): URL {
    if (typeof input === 'string' || input instanceof URL) {
        return new URL(input);
    }

    return new URL(input.url);
}

function assertRecord(input: unknown): Record<string, unknown> {
    if (typeof input !== 'object' || input === null) {
        throw new TypeError('Expected an object.');
    }

    return input as Record<string, unknown>;
}

function assertString(input: unknown, name: string): string {
    if (typeof input !== 'string') {
        throw new TypeError(`Expected ${name} to be a string.`);
    }

    return input;
}
