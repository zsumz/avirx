import { describe, expect, it } from 'vitest';
import { createConcurrencyQueue } from '../../../src/policy/concurrency/queue.js';
import { createRateLimitQueue, type RateLimitQueueEntry } from '../../../src/policy/rate-limit/queue.js';

interface Queue<Entry> {
    dequeue(): Entry | undefined;
    enqueue(entry: Entry): void;
    remove(entry: Entry): unknown;
    size(): number;
}

describe('policy queue cancellation churn', () => {
    it('preserves concurrency FIFO after removing ten thousand transient entries', () => {
        verifyChurn(createConcurrencyQueue(), () => ({ grant: () => undefined }));
    });

    it('preserves rate FIFO after removing ten thousand transient entries', () => {
        verifyChurn(createRateLimitQueue(), createRateEntry);
    });
});

function verifyChurn<Entry>(queue: Queue<Entry>, createEntry: () => Entry): void {
    const first = createEntry();
    const second = createEntry();
    queue.enqueue(first);
    for (let index = 0; index < 10_000; index += 1) {
        const transient = createEntry();
        queue.enqueue(transient);
        queue.remove(transient);
    }
    expect(queue.size()).toBe(1);
    queue.enqueue(second);
    expect(queue.dequeue()).toBe(first);
    expect(queue.size()).toBe(1);
    expect(queue.dequeue()).toBe(second);
    expect(queue.size()).toBe(0);

    for (let index = 0; index < 10_000; index += 1) {
        const transient = createEntry();
        queue.enqueue(transient);
        queue.remove(transient);
    }
    expect(queue.size()).toBe(0);
    expect(queue.dequeue()).toBeUndefined();
}

function createRateEntry(): RateLimitQueueEntry {
    return {
        reject: () => undefined,
        request: {} as RateLimitQueueEntry['request'],
        resolve: () => undefined,
    };
}
