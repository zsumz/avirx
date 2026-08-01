import type { AvirxBodyMetadata, AvirxBodyValue } from '../types.js';
import { isJsonContentType } from './json.js';

export function classifyBody(body: AvirxBodyValue): AvirxBodyMetadata {
    if (body === null || body === undefined) {
        return Object.freeze({ kind: 'none' });
    }

    if (typeof body === 'string') {
        return Object.freeze({
            contentLength: new TextEncoder().encode(body).byteLength,
            contentType: 'text/plain;charset=UTF-8',
            kind: 'text',
        });
    }

    if (body instanceof URLSearchParams) {
        return Object.freeze({
            contentType: 'application/x-www-form-urlencoded;charset=UTF-8',
            kind: 'url-search-params',
        });
    }

    if (body instanceof FormData) {
        return Object.freeze({ kind: 'form' });
    }

    if (body instanceof Blob) {
        const metadata: { contentLength: number; contentType?: string; kind: 'binary' } = {
            contentLength: body.size,
            kind: 'binary',
        };

        if (body.type) {
            metadata.contentType = body.type;
        }

        return Object.freeze(metadata);
    }

    if (body instanceof ArrayBuffer) {
        return Object.freeze({ contentLength: body.byteLength, kind: 'binary' });
    }

    if (body instanceof ReadableStream) {
        return Object.freeze({ kind: 'stream' });
    }

    return Object.freeze({ contentType: 'application/json', kind: 'json' });
}

export function shouldEncodeJson(body: AvirxBodyValue, contentType?: string): boolean {
    return classifyBody(body).kind === 'json' && (contentType === undefined || isJsonContentType(contentType));
}
