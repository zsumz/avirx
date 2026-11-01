import { forbidsCache, isPublicCacheResponse } from './eligibility.js';
import { hasSensitiveHeaders } from './keys.js';
import { createCacheStore } from './store.js';
import { isWithinKnownMaxBytes } from './response.js';
import { normalizeCacheOptions } from './options.js';
import type {
    AvirxBuiltRequest,
    AvirxCacheInput,
    AvirxCacheMethod,
    AvirxCachePolicy,
    AvirxResponse,
} from '../../types.js';

export { isCachedResponse } from './response.js';

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
        return !request.authenticated && !forbidsCache(request.headers)
      && options.methods.has(request.method as AvirxCacheMethod)
      && request.sensitiveHeaders.length === 0
      && !hasSensitiveHeaders(request.headers)
      && request.url.href === request.redactedUrl.href;
    }

    function canCacheResponse(response: AvirxResponse): boolean {
        return isPublicCacheResponse(response, options.vary)
          && isWithinKnownMaxBytes(response, options.maxBytes);
    }

    const policy = {
        clear: store.clear,
        async set(request, response) {
            if (!canCacheRequest(request) || !canCacheResponse(response)) {
                return;
            }

            await store.set(request, response);
        },
        canCacheRequest,
        canCacheResponse,
        get,
        maxEntries: options.maxEntries,
        maxTotalBytes: options.maxTotalBytes,
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
