import type { AvirxError } from '../../error/avirx-error.js';
import type { AvirxBuiltRequest } from '../../types.js';

export interface RateLimitQueueEntry {
    abort?: () => void;
    request: AvirxBuiltRequest;
    reject: (error: AvirxError) => void;
    resolve: () => void;
    signal?: AbortSignal;
    timeout?: ReturnType<typeof setTimeout>;
}

export function createRateLimitQueue(): Readonly<{
    dequeue(): RateLimitQueueEntry | undefined;
    enqueue(entry: RateLimitQueueEntry): void;
    remove(entry: RateLimitQueueEntry): boolean;
    size(): number;
}> {
    const queue: Set<RateLimitQueueEntry> = new Set();

    return Object.freeze({
        dequeue() {
            const entry = queue.values().next().value;
            if (entry) queue.delete(entry);
            return entry;
        },
        enqueue(entry) {
            queue.add(entry);
        },
        remove(entry) {
            return queue.delete(entry);
        },
        size() {
            return queue.size;
        },
    });
}
