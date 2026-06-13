import type { AvirxRetryInput, AvirxRetryMetadata, HttpMethod } from '../types.js';

const DEFAULT_RETRY_STATUSES = Object.freeze([408, 429, 500, 502, 503, 504]);
const IDEMPOTENT_METHODS: Set<HttpMethod> = new Set(['DELETE', 'GET', 'HEAD', 'OPTIONS', 'PUT']);
const MAX_RETRY_AFTER_DELAY_MS = 60_000;
const MAX_RETRY_ATTEMPTS = 10;

export function normalizeRetry(input: AvirxRetryInput): AvirxRetryMetadata {
    const config = typeof input === 'number' ? { attempts: input } : input;

    return Object.freeze({
        attempts: normalizeRetryAttempts(config.attempts),
        on: normalizeRetryStatuses(config.on ?? DEFAULT_RETRY_STATUSES),
        safeOnly: true,
    });
}

export function canRetryMethod(method: HttpMethod, retry: AvirxRetryMetadata): boolean {
    return !retry.safeOnly || IDEMPOTENT_METHODS.has(method);
}

export function calculateRetryDelayMs(
    attempt: number,
    retryAfter?: string | null,
    nowMs = Date.now(),
): number {
    const retryAfterMs = parseRetryAfterMs(retryAfter, nowMs);
    if (retryAfterMs !== undefined) {
        return retryAfterMs;
    }

    return 10 * 2 ** Math.max(0, attempt - 1);
}

function normalizeRetryAttempts(value: number): number {
    if (!Number.isInteger(value) || value < 0 || value > MAX_RETRY_ATTEMPTS) {
        throw new TypeError(
            `Retry attempts must be a non-negative integer from 0 to ${String(MAX_RETRY_ATTEMPTS)}.`,
        );
    }

    return value;
}

function normalizeRetryStatuses(statuses: readonly number[]): readonly number[] {
    if (statuses.length === 0) {
        throw new TypeError('Retry status list cannot be empty.');
    }

    return Object.freeze(statuses.map(validateRetryStatus));
}

function validateRetryStatus(status: number): number {
    if (!Number.isInteger(status) || status < 100 || status > 599) {
        throw new TypeError(
            `Invalid retry status ${String(status)}. Expected an integer from 100 to 599.`,
        );
    }

    return status;
}

function parseRetryAfterMs(value: string | null | undefined, nowMs: number): number | undefined {
    if (value === undefined || value === null) {
        return undefined;
    }

    const trimmed = value.trim();
    if (trimmed === '') {
        return undefined;
    }

    if (/^\d+$/u.test(trimmed)) {
        return Math.min(Number(trimmed) * 1000, MAX_RETRY_AFTER_DELAY_MS);
    }

    const timestamp = Date.parse(trimmed);
    if (!Number.isFinite(timestamp)) {
        return undefined;
    }

    const delayMs = timestamp - nowMs;
    if (delayMs <= 0) {
        return undefined;
    }

    return Math.min(delayMs, MAX_RETRY_AFTER_DELAY_MS);
}
