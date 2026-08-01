import type { AvirxDurationInput } from '../types.js';

export const MAX_TIMER_DELAY_MS = 2_147_483_647;

export function normalizeDurationMs(input: AvirxDurationInput): number {
    if (typeof input === 'number') {
        return assertFiniteMilliseconds(input);
    }

    const value = input.trim();
    if (value.endsWith('ms')) {
        return assertFiniteMilliseconds(parseDurationNumber(value.slice(0, -2), input));
    }

    if (value.endsWith('s')) {
        return assertFiniteMilliseconds(parseDurationNumber(value.slice(0, -1), input) * 1000);
    }

    throw new TypeError(`Unsupported duration "${input}". Use milliseconds or seconds.`);
}

function assertFiniteMilliseconds(value: number): number {
    if (!Number.isFinite(value) || value < 0) {
        throw new TypeError('Duration must be a non-negative finite number of milliseconds.');
    }

    if (value > MAX_TIMER_DELAY_MS) {
        throw new TypeError(
            `Duration must be no greater than ${String(MAX_TIMER_DELAY_MS)} milliseconds.`,
        );
    }

    return value;
}

function parseDurationNumber(value: string, input: string): number {
    if (!/^\d+(?:\.\d+)?$/u.test(value)) {
        throw new TypeError(`Unsupported duration "${input}". Use milliseconds or seconds.`);
    }

    return Number(value);
}
