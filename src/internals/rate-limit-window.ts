import type { NormalizedRateLimitOptions } from './rate-limit-options.js';

export function createRateLimitWindow(options: Pick<NormalizedRateLimitOptions, 'perMs' | 'requests'>): Readonly<{
    active(now: number): number;
    canStart(now: number): boolean;
    nextDelay(now: number): number | undefined;
    record(now: number): void;
}> {
    const starts: number[] = [];
    let startsHead = 0;

    function prune(now: number): void {
        while (startsHead < starts.length) {
            const startedAt = starts[startsHead];
            if (startedAt === undefined || now - startedAt < options.perMs) {
                break;
            }
            startsHead += 1;
        }
        compactStarts();
    }

    function activeStarts(): number {
        return starts.length - startsHead;
    }

    function compactStarts(): void {
        if (startsHead > 32 && startsHead * 2 >= starts.length) {
            starts.splice(0, startsHead);
            startsHead = 0;
        }
    }

    return Object.freeze({
        active(now) {
            prune(now);
            return activeStarts();
        },
        canStart(now) {
            prune(now);
            return activeStarts() < options.requests;
        },
        nextDelay(now) {
            prune(now);
            const oldest = starts[startsHead];
            if (oldest === undefined || activeStarts() < options.requests) {
                return undefined;
            }

            return Math.max(0, oldest + options.perMs - now);
        },
        record(now) {
            starts.push(now);
        },
    });
}
