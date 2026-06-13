import { AvirxError } from '../errors.js';
import { createRateLimitQueue, type RateLimitQueueEntry } from './rate-limit-queue.js';
import { createRateLimitWindow } from './rate-limit-window.js';
import { normalizeRateLimit } from './rate-limit-options.js';
import type {
    AvirxRateLimitInput,
    AvirxRateLimitLimiter,
} from '../types.js';

export function createRateLimitLimiter(input: AvirxRateLimitInput): AvirxRateLimitLimiter {
    const options = normalizeRateLimit(input);
    const starts = createRateLimitWindow(options);
    const queue = createRateLimitQueue();
    let timer: ReturnType<typeof setTimeout> | undefined;

    function admit(entry: RateLimitQueueEntry, now: number): void {
        clearQueueEntry(entry);
        starts.record(now);
        entry.resolve();
    }

    function schedule(): void {
        if (timer || queue.size() === 0) {
            return;
        }

        const delay = starts.nextDelay(Date.now());
        if (delay === undefined) {
            drain();
            return;
        }

        timer = setTimeout(() => {
            timer = undefined;
            drain();
        }, delay);
    }

    function drain(): void {
        while (queue.size() > 0 && starts.canStart(Date.now())) {
            const entry = queue.dequeue();
            if (entry) {
                admit(entry, Date.now());
            }
        }

        schedule();
    }

    function remove(entry: RateLimitQueueEntry): void {
        if (queue.remove(entry)) {
            clearQueueEntry(entry);
        }
    }

    function clearQueueEntry(entry: RateLimitQueueEntry): void {
        if (entry.timeout) {
            clearTimeout(entry.timeout);
        }
        if (entry.abort && entry.signal) {
            entry.signal.removeEventListener('abort', entry.abort);
        }
    }

    return Object.freeze({
        async acquire(request, signal) {
            return new Promise((resolve, reject) => {
                if (signal?.aborted) {
                    reject(new AvirxError('Request aborted.', { cause: signal.reason, request }));
                    return;
                }

                const now = Date.now();
                if (queue.size() === 0 && starts.canStart(now)) {
                    starts.record(now);
                    resolve();
                    return;
                }

                if (options.queue !== undefined && queue.size() >= options.queue) {
                    reject(new AvirxError('Rate limit queue is full.', { request }));
                    return;
                }

                const entry: RateLimitQueueEntry = {
                    reject,
                    request,
                    resolve,
                };
                if (signal) {
                    entry.signal = signal;
                }

                if (signal) {
                    entry.abort = () => {
                        remove(entry);
                        reject(new AvirxError('Request aborted.', { cause: signal.reason, request }));
                    };
                    signal.addEventListener('abort', entry.abort, { once: true });
                }

                if (options.queueTimeoutMs !== undefined) {
                    entry.timeout = setTimeout(() => {
                        remove(entry);
                        reject(new AvirxError('Rate limit queue timed out.', { request }));
                    }, options.queueTimeoutMs);
                }

                queue.enqueue(entry);
                schedule();
            });
        },
        perMs: options.perMs,
        queued() {
            return queue.size();
        },
        requests: options.requests,
        starts() {
            return starts.active(Date.now());
        },
    });
}
