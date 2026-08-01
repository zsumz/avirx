import { createAvirxResponse } from '../../response/response.js';
import { normalizeHeaders } from '../../transport/headers.js';
import type { AvirxBuiltRequest, AvirxHeaders, AvirxResponse } from '../../types.js';

export type CachedResponse = Readonly<{
    body: ArrayBuffer;
    expiresAt: number;
    headers: AvirxHeaders;
    status: number;
    statusText: string;
    storedAt: number;
    url: string;
}>;

const cachedResponses: WeakSet<AvirxResponse> = new WeakSet();

export function isCachedResponse(response: AvirxResponse): boolean {
    return cachedResponses.has(response);
}

export function createCachedResponse(
    request: AvirxBuiltRequest,
    cached: CachedResponse,
    now: number,
): AvirxResponse {
    const body = cached.status === 204 || cached.status === 205
        ? null
        : cached.body.slice(0);
    const native = new Response(body, {
        headers: normalizeHeaders(cached.headers),
        status: cached.status,
        statusText: cached.statusText,
    });

    const response = createAvirxResponse(native, request, Object.freeze({
        durationMs: 0,
        endedAt: now,
        startedAt: now,
    }));
    cachedResponses.add(response);
    return response;
}

export function isWithinKnownMaxBytes(response: AvirxResponse, maxBytes: number | undefined): boolean {
    if (maxBytes === undefined) {
        return true;
    }

    const contentLength = parseContentLength(response.headers['content-length']);
    return contentLength !== undefined && contentLength <= maxBytes;
}

function parseContentLength(value: string | undefined): number | undefined {
    if (value === undefined || !/^\d+$/u.test(value)) {
        return undefined;
    }

    const contentLength = Number(value);
    return Number.isSafeInteger(contentLength) ? contentLength : undefined;
}
