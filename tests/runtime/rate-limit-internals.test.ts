import { describe, expect, it, vi } from 'vitest';

import { createRateLimitQueue, type RateLimitQueueEntry } from '../../src/internals/rate-limit-queue.js';
import { createRateLimitWindow } from '../../src/internals/rate-limit-window.js';

describe('rate limit internals', () => {
    it('tracks rolling-window capacity and delay', () => {
        const window = createRateLimitWindow({ perMs: 100, requests: 2 });

        expect(window.canStart(0)).toBe(true);
        window.record(0);
        window.record(10);

        expect(window.active(20)).toBe(2);
        expect(window.canStart(20)).toBe(false);
        expect(window.nextDelay(20)).toBe(80);
        expect(window.canStart(100)).toBe(true);
        expect(window.active(100)).toBe(1);
    });

    it('keeps FIFO order when removed entries leave sparse queue slots', () => {
        const queue = createRateLimitQueue();
        const first = createQueueEntry();
        const skipped = createQueueEntry();
        const third = createQueueEntry();

        queue.enqueue(first);
        queue.enqueue(skipped);
        queue.enqueue(third);

        expect(queue.size()).toBe(3);
        expect(queue.remove(skipped)).toBe(true);
        expect(queue.size()).toBe(2);
        expect(queue.dequeue()).toBe(first);
        expect(queue.dequeue()).toBe(third);
        expect(queue.dequeue()).toBeUndefined();
        expect(queue.remove(skipped)).toBe(false);
    });
});

function createQueueEntry(): RateLimitQueueEntry {
    return {
        reject: vi.fn(),
        request: {} as RateLimitQueueEntry['request'],
        resolve: vi.fn(),
    };
}
