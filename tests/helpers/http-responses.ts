import type { HttpTestResponse } from './http-types.js';

export function httpJson(
    data: unknown,
    init: Omit<HttpTestResponse, 'body'> = {},
): HttpTestResponse {
    const headers = withDefaultContentType(init.headers, 'application/json');
    return {
        ...init,
        body: JSON.stringify(data),
        headers,
    };
}

export function httpText(
    body: string,
    init: Omit<HttpTestResponse, 'body'> = {},
): HttpTestResponse {
    const headers = withDefaultContentType(init.headers, 'text/plain; charset=utf-8');
    return { ...init, body, headers };
}

export function httpEmpty(
    init: Omit<HttpTestResponse, 'body'> = {},
): HttpTestResponse {
    return init;
}

function withDefaultContentType(
    input: HeadersInit | undefined,
    contentType: string,
): Headers {
    const headers = new Headers(input);
    if (!headers.has('content-type')) {
        headers.set('content-type', contentType);
    }
    return headers;
}
