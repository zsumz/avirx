import { toFetchBody } from '../request/fetch-body.js';
import type { AvirxBuiltRequest } from '../types.js';

export function createFetchInit(
    request: AvirxBuiltRequest,
    signal: AbortSignal | undefined,
): RequestInit {
    const init: RequestInit & { duplex?: 'half' } = {
        headers: request.headers,
        method: request.method,
    };

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
