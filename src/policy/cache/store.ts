import { createCacheKey } from './keys.js';
import { createCachedResponse, type CachedResponse } from './response.js';
import type { AvirxBuiltRequest, AvirxResponse } from '../../types.js';
import type { NormalizedCacheOptions } from './options.js';

export function createCacheStore(options: Pick<NormalizedCacheOptions, 'maxBytes' | 'ttlMs' | 'vary'>): Readonly<{
    get(request: AvirxBuiltRequest): AvirxResponse | undefined;
    set(request: AvirxBuiltRequest, response: AvirxResponse): Promise<void>;
    size(): number;
}> {
    const entries: Map<string, CachedResponse> = new Map();

    return Object.freeze({
        get(request) {
            const key = createCacheKey(request, options.vary);
            const cached = entries.get(key);
            if (!cached) {
                return undefined;
            }

            const now = Date.now();
            if (cached.expiresAt <= now) {
                entries.delete(key);
                return undefined;
            }

            return createCachedResponse(request, cached, now);
        },
        async set(request, response) {
            const body = await response.native.clone().arrayBuffer();
            if (options.maxBytes !== undefined && body.byteLength > options.maxBytes) {
                return;
            }

            const now = Date.now();
            entries.set(createCacheKey(request, options.vary), Object.freeze({
                body,
                expiresAt: now + options.ttlMs,
                headers: response.headers,
                status: response.status,
                statusText: response.statusText,
                storedAt: now,
                url: response.url,
            }));
        },
        size() {
            pruneExpired(entries, Date.now());
            return entries.size;
        },
    });
}

function pruneExpired(entries: Map<string, CachedResponse>, now: number): void {
    for (const [key, entry] of entries) {
        if (entry.expiresAt <= now) {
            entries.delete(key);
        }
    }
}
