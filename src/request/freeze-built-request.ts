import type { MutableBuiltRequest } from './built-request-types.js';
import type { AvirxBuiltRequest } from '../types.js';

export function freezeBuiltRequest(request: MutableBuiltRequest): AvirxBuiltRequest {
    const urlHref = request.url.href;
    const redactedUrlHref = request.redactedUrl.href;
    const snapshot: Partial<MutableBuiltRequest> = {
        bodyMetadata: request.bodyMetadata,
        headers: request.headers,
        method: request.method,
        redactedHeaders: request.redactedHeaders,
        sensitiveHeaders: request.sensitiveHeaders,
    };
    Object.defineProperties(snapshot, {
        redactedUrl: {
            enumerable: true,
            get() {
                return new URL(redactedUrlHref);
            },
        },
        url: {
            enumerable: true,
            get() {
                return new URL(urlHref);
            },
        },
    });
    if ('body' in request) snapshot.body = request.body;
    if (request.retry) snapshot.retry = request.retry;
    if (request.timeoutMs !== undefined) snapshot.timeoutMs = request.timeoutMs;
    return Object.freeze(snapshot) as AvirxBuiltRequest;
}
