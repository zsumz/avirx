import { hasSensitiveHeaders } from './cache-keys.js';
import { createCacheStore } from './cache-store.js';
import { isWithinKnownMaxBytes } from './cache-response.js';
import { normalizeCacheOptions } from './cache-options.js';
import type {
    AvirxBuiltRequest,
    AvirxCacheInput,
    AvirxCacheMethod,
    AvirxCachePolicy,
    AvirxResponse,
} from '../types.js';

export { isCachedResponse } from './cache-response.js';

export function createCachePolicy(input: AvirxCacheInput): AvirxCachePolicy {
    const options = normalizeCacheOptions(input);
    const store = createCacheStore(options);

    function get(request: AvirxBuiltRequest): AvirxResponse | undefined {
        if (!canCacheRequest(request)) {
            return undefined;
        }

        return store.get(request);
    }

    function canCacheRequest(request: AvirxBuiltRequest): boolean {
        return options.methods.has(request.method as AvirxCacheMethod)
      && request.sensitiveHeaders.length === 0
      && !hasSensitiveHeaders(request.headers)
      && request.url.href === request.redactedUrl.href;
    }

    function canCacheResponse(response: AvirxResponse): boolean {
        return response.ok && isWithinKnownMaxBytes(response, options.maxBytes);
    }

    const policy = {
        async set(request, response) {
            if (!canCacheRequest(request) || !canCacheResponse(response)) {
                return;
            }

            await store.set(request, response);
        },
        canCacheRequest,
        canCacheResponse,
        get,
        size() {
            return store.size();
        },
        ttlMs: options.ttlMs,
    } satisfies Omit<AvirxCachePolicy, 'maxBytes'>;

    return Object.freeze(options.maxBytes === undefined
        ? policy
        : {
            ...policy,
            maxBytes: options.maxBytes,
        });
}
