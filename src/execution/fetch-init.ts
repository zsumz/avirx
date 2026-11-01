import { toFetchBody } from '../request/fetch-body.js';
import { isSensitiveHeader } from '../transport/redact.js';
import type { AvirxBuiltRequest } from '../types.js';

export function createFetchInit(
    request: AvirxBuiltRequest,
    signal: AbortSignal | undefined,
    allowCredentialRedirects = false,
): RequestInit {
    const init: RequestInit & { duplex?: 'half' } = {
        headers: Object.entries(request.headers),
        method: request.method,
    };
    if (!allowCredentialRedirects && carriesCustomCredentials(request)) {
        init.redirect = 'error';
    }

    if ('body' in request) {
        const body = toFetchBody(request.body);
        if (body !== undefined) {
            init.body = body;
            if (body instanceof ReadableStream) {
                init.duplex = 'half';
            }
        }
    }
    if (signal) {
        init.signal = signal;
    }

    return init;
}

function carriesCustomCredentials(request: AvirxBuiltRequest): boolean {
    return request.sensitiveHeaders.some((name) => name.toLowerCase() !== 'authorization')
        || Object.keys(request.headers).some((name) => name !== 'authorization' && isSensitiveHeader(name));
}
