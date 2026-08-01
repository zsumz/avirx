import { createConcurrencyQueue } from './queue.js';
import { normalizeConcurrency } from './options.js';
import type { ConcurrencyQueueEntry } from './queue.js';
import type { AvirxConcurrencyLimiter, AvirxConcurrencyInput } from '../../types.js';

export function createConcurrencyLimiter(input: AvirxConcurrencyInput): AvirxConcurrencyLimiter {
    const max = normalizeConcurrency(input);
    const queue = createConcurrencyQueue();
    let active = 0;

    function release(): void {
        active -= 1;
        const next = queue.dequeue();
        if (next) {
            detachAbortListener(next);
            next.grant();
        }
    }

    function createRelease(): () => void {
        let released = false;
        return () => {
            if (!released) {
                released = true;
                release();
            }
        };
    }

    function grant(resolve: (releaseSlot: () => void) => void): void {
        active += 1;
        resolve(createRelease());
    }

    return Object.freeze({
        async acquire(signal) {
            return new Promise((resolve, reject) => {
                if (signal?.aborted) {
                    reject(createAbortReasonError(signal));
                    return;
                }
                if (active < max) {
                    grant(resolve);
                    return;
                }

                const entry: ConcurrencyQueueEntry = {
                    grant: () => {
                        grant(resolve);
                    },
                };
                if (signal) {
                    entry.signal = signal;
                    entry.abort = () => {
                        queue.remove(entry);
                        reject(createAbortReasonError(signal));
                    };
                    signal.addEventListener('abort', entry.abort, { once: true });
                }
                queue.enqueue(entry);
            });
        },
        active() {
            return active;
        },
        max,
        queued() {
            return queue.size();
        },
    });
}

function detachAbortListener(entry: ConcurrencyQueueEntry): void {
    if (entry.abort && entry.signal) {
        entry.signal.removeEventListener('abort', entry.abort);
    }
}

function createAbortReasonError(signal: AbortSignal): Error {
    return signal.reason instanceof Error
        ? signal.reason
        : new Error('Request aborted.');
}
