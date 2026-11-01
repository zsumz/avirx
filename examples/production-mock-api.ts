import type { ExampleCall, ProductionMockApi } from './production-types.js';

export function createProductionMockApi(): ProductionMockApi {
    const baseUrl = 'https://api.example.test';
    const calls: ExampleCall[] = [];

    const fetchImpl: typeof fetch = async (input, init) => {
        await Promise.resolve();
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
            return jsonResponse({ id: 'slow', title: 'Slow catalog response' });
        }
        if (method === 'GET' && url.pathname === '/public/books/book_cache') {
            return jsonResponse({ id: 'book_cache', title: 'A Wizard of Earthsea' }, {
                headers: { 'cache-control': 'public' },
            });
        }
        if (method === 'GET' && url.pathname.startsWith('/books/')) {
            return createBookResponse(url, authorization);
        }
        return jsonResponse(
            { code: 'not_found', message: 'Missing route.' },
            { status: 404 },
        );
    };

    return { baseUrl, calls, fetch: fetchImpl };
}

export function countCalls(calls: readonly ExampleCall[], path: string): number {
    return calls.filter((call) => new URL(call.url).pathname === path).length;
}

function createBookResponse(url: URL, authorization: string | undefined): Response {
    if (authorization !== 'Bearer token_123') {
        return jsonResponse(
            { code: 'unauthorized', message: 'Token expired.' },
            { status: 401 },
        );
    }

    const id = url.pathname.slice('/books/'.length);
    return jsonResponse({
        id,
        title: id === 'book_456' ? 'Pattern Recognition' : 'The Left Hand of Darkness',
    });
}

function jsonResponse(data: unknown, init: ResponseInit = {}): Response {
    const headers = new Headers(init.headers);
    if (!headers.has('content-type')) {
        headers.set('content-type', 'application/json');
    }
    return new Response(JSON.stringify(data), { ...init, headers });
}

function toUrl(input: Parameters<typeof fetch>[0]): URL {
    if (typeof input === 'string' || input instanceof URL) {
        return new URL(input);
    }
    return new URL(input.url);
}
