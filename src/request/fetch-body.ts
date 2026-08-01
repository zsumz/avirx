import type { AvirxBodyValue } from '../types.js';

export function toFetchBody(body: AvirxBodyValue): BodyInit | null | undefined {
    if (body === undefined || body === null) {
        return undefined;
    }
    if (
        typeof body === 'string'
        || body instanceof ArrayBuffer
        || body instanceof Blob
        || body instanceof FormData
        || body instanceof ReadableStream
        || body instanceof URLSearchParams
    ) {
        return body;
    }
    return JSON.stringify(body);
}
