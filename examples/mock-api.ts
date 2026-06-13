export type ExampleBook = Readonly<{
    id: string;
    title: string;
}>;

export type MockApiCall = Readonly<{
    body?: string;
    method: string;
    url: string;
}>;

export type MockApi = Readonly<{
    baseUrl: string;
    calls: MockApiCall[];
    fetch: typeof fetch;
}>;

const books: readonly ExampleBook[] = Object.freeze([
    Object.freeze({ id: 'book_123', title: 'The Left Hand of Darkness' }),
    Object.freeze({ id: 'book_456', title: 'Pattern Recognition' }),
]);

export function createMockApi(): MockApi {
    const calls: MockApiCall[] = [];
    const baseUrl = 'https://api.example.test';

    const fetchImpl: typeof fetch = async (input, init) => {
        const url = toUrl(input);
        const method = init?.method ?? (input instanceof Request ? input.method : 'GET');
        const body = typeof init?.body === 'string' ? init.body : undefined;
        calls.push(Object.freeze({ ...body === undefined ? {} : { body }, method, url: url.href }));

        if (method === 'GET' && url.pathname === '/books') {
            return Promise.resolve(
                jsonResponse({
                    items: books,
                    status: url.searchParams.get('status') ?? 'all',
                }),
            );
        }

        if (method === 'GET' && url.pathname.startsWith('/books/')) {
            const id = url.pathname.slice('/books/'.length);
            const book = books.find((item) => item.id === id);

            if (!book) {
                return Promise.resolve(jsonResponse({ code: 'missing' }, { status: 404 }));
            }

            return Promise.resolve(jsonResponse(book));
        }

        if (method === 'POST' && url.pathname === '/books') {
            const payload = body ? JSON.parse(body) as { title?: unknown } : {};
            const title = typeof payload.title === 'string' ? payload.title : 'Untitled';
            return Promise.resolve(jsonResponse({ id: 'book_new', title }, { status: 201 }));
        }

        return Promise.resolve(jsonResponse({ code: 'not_found' }, { status: 404 }));
    };

    return Object.freeze({
        baseUrl,
        calls,
        fetch: fetchImpl,
    });
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
