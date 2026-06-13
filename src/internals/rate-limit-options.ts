import { normalizeDurationMs } from './duration.js';
import type { AvirxRateLimitInput } from '../types.js';

export interface NormalizedRateLimitOptions {
    perMs: number;
    queue?: number;
    queueTimeoutMs?: number;
    requests: number;
}

export function normalizeRateLimit(input: AvirxRateLimitInput): NormalizedRateLimitOptions {
    if (!Number.isSafeInteger(input.requests) || input.requests < 1) {
        throw new TypeError('Rate limit requests must be a positive integer.');
    }

    const perMs = normalizeDurationMs(input.per);
    if (perMs <= 0) {
        throw new TypeError('Rate limit window must be greater than 0 milliseconds.');
    }

    const normalized: NormalizedRateLimitOptions = {
        perMs,
        requests: input.requests,
    };

    if (input.queue !== undefined) {
        if (!Number.isSafeInteger(input.queue) || input.queue < 0) {
            throw new TypeError('Rate limit queue must be a non-negative integer.');
        }
        normalized.queue = input.queue;
    }

    if (input.queueTimeout !== undefined) {
        const queueTimeoutMs = normalizeDurationMs(input.queueTimeout);
        if (queueTimeoutMs <= 0) {
            throw new TypeError('Rate limit queue timeout must be greater than 0 milliseconds.');
        }
        normalized.queueTimeoutMs = queueTimeoutMs;
    }

    return normalized;
}
