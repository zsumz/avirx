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
    const queue: Array<RateLimitQueueEntry | undefined> = [];
    let queueHead = 0;
    let queued = 0;

    function compactQueue(): void {
        if (queueHead > 32 && queueHead * 2 >= queue.length) {
            queue.splice(0, queueHead);
            queueHead = 0;
        }
    }

    return Object.freeze({
        dequeue() {
            while (queueHead < queue.length) {
                const entry = queue[queueHead];
                queue[queueHead] = undefined;
                queueHead += 1;
                if (entry) {
                    queued -= 1;
                    compactQueue();
                    return entry;
                }
            }

            compactQueue();
            return undefined;
        },
        enqueue(entry) {
            queue.push(entry);
            queued += 1;
        },
        remove(entry) {
            const index = queue.indexOf(entry, queueHead);
            if (index === -1) {
                return false;
            }

            queue[index] = undefined;
            queued -= 1;
            compactQueue();
            return true;
        },
        size() {
            return queued;
        },
    });
}
