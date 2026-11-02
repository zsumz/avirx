import { createCacheKey } from './keys.js';
import { createCachedResponse, type CachedResponse } from './response.js';
import { readCacheBody } from './read-body.js';
import { elapsedNow } from '../../time/clock.js';
import type { AvirxBuiltRequest, AvirxResponse } from '../../types.js';
import type { NormalizedCacheOptions } from './options.js';

type StoreOptions = Pick<NormalizedCacheOptions, 'maxBytes' | 'maxEntries' | 'maxTotalBytes' | 'ttlMs' | 'vary'>;

export function createCacheStore(options: StoreOptions): Readonly<{
    clear(): void;
    generation(): number;
    get(request: AvirxBuiltRequest): AvirxResponse | undefined;
    set(request: AvirxBuiltRequest, response: AvirxResponse): Promise<void>;
    size(): number;
}> {
    const entries: Map<string, CachedResponse> = new Map();
    let totalBytes = 0;
    let generation = 0;

    function remove(key: string): void {
        const entry = entries.get(key);
        if (entry) {
            totalBytes -= entry.body.byteLength;
            entries.delete(key);
        }
    }

    function pruneExpired(now: number): void {
        for (const [key, entry] of entries) {
            if (entry.expiresAt <= now) remove(key);
        }
    }

    return Object.freeze({
        clear() {
            generation += 1;
            entries.clear();
            totalBytes = 0;
        },
        generation() {
            return generation;
        },
        get(request) {
            const now = elapsedNow();
            pruneExpired(now);
            const key = createCacheKey(request, options.vary);
            const cached = entries.get(key);
            if (!cached) return undefined;
            entries.delete(key);
            entries.set(key, cached);
            return createCachedResponse(request, cached, Date.now());
        },
        async set(request, response) {
            pruneExpired(elapsedNow());
            const writeGeneration = generation;
            const limit = Math.min(options.maxBytes ?? options.maxTotalBytes, options.maxTotalBytes);
            const body = await readCacheBody(response.native.clone(), limit);
            if (body === undefined || writeGeneration !== generation) return;

            const now = elapsedNow();
            pruneExpired(now);
            const key = createCacheKey(request, options.vary);
            remove(key);
            while (entries.size >= options.maxEntries || totalBytes + body.byteLength > options.maxTotalBytes) {
                const oldest = entries.keys().next().value;
                if (oldest === undefined) return;
                remove(oldest);
            }
            entries.set(key, Object.freeze({
                body,
                expiresAt: now + options.ttlMs,
                headers: response.headers,
                status: response.status,
                statusText: response.statusText,
                storedAt: Date.now(),
                url: response.url,
            }));
            totalBytes += body.byteLength;
        },
        size() {
            pruneExpired(elapsedNow());
            return entries.size;
        },
    });
}
