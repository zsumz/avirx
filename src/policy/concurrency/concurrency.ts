import type { AvirxConcurrencyLimiter, AvirxConcurrencyInput } from '../../types.js';

interface QueueEntry {
    abort?: () => void;
    grant: () => void;
    reject: (error: Error) => void;
    signal?: AbortSignal;
}

export function normalizeConcurrency(input: AvirxConcurrencyInput): number {
    if (!Number.isSafeInteger(input) || input < 1) {
        throw new TypeError('Concurrency limit must be a positive integer.');
    }

    return input;
}

export function createConcurrencyLimiter(input: AvirxConcurrencyInput): AvirxConcurrencyLimiter {
    const max = normalizeConcurrency(input);
    const queue: Array<QueueEntry | undefined> = [];
    let active = 0;
    let head = 0;
    let queued = 0;

    function release(): void {
        active -= 1;
        const next = dequeue();
        if (next) {
            if (next.abort && next.signal) {
                next.signal.removeEventListener('abort', next.abort);
            }
            next.grant();
        }
    }

    function createRelease(): () => void {
        let released = false;

        return () => {
            if (released) {
                return;
            }

            released = true;
            release();
        };
    }

    function grant(resolve: (release: () => void) => void): void {
        active += 1;
        resolve(createRelease());
    }

    function remove(entry: QueueEntry): void {
        const index = queue.indexOf(entry, head);
        if (index !== -1) {
            queue[index] = undefined;
            queued -= 1;
            if (entry.abort && entry.signal) {
                entry.signal.removeEventListener('abort', entry.abort);
            }
            compactQueue();
        }
    }

    function enqueue(entry: QueueEntry): void {
        queue.push(entry);
        queued += 1;
    }

    function dequeue(): QueueEntry | undefined {
        while (head < queue.length) {
            const entry = queue[head];
            queue[head] = undefined;
            head += 1;
            if (entry) {
                queued -= 1;
                compactQueue();
                return entry;
            }
        }

        compactQueue();
        return undefined;
    }

    function compactQueue(): void {
        if (head > 32 && head * 2 >= queue.length) {
            queue.splice(0, head);
            head = 0;
        }
    }

    return Object.freeze({
        async acquire(signal) {
            return new Promise((resolve, reject) => {
                if (signal?.aborted) {
                    reject(createAbortReasonError(signal));
                    return;
                }

                const acquire = (): void => {
                    grant(resolve);
                };

                if (active < max) {
                    acquire();
                    return;
                }

                const entry: QueueEntry = {
                    grant: acquire,
                    reject: (error) => {
                        remove(entry);
                        reject(error);
                    },
                };
                if (signal) {
                    entry.signal = signal;
                    entry.abort = () => {
                        entry.reject(createAbortReasonError(signal));
                    };
                }

                if (entry.abort) {
                    signal?.addEventListener('abort', entry.abort, { once: true });
                }
                enqueue(entry);
            });
        },
        active() {
            return active;
        },
        max,
        queued() {
            return queued;
        },
    });
}

function createAbortReasonError(signal: AbortSignal): Error {
    return signal.reason instanceof Error
        ? signal.reason
        : new Error('Request aborted.');
}
