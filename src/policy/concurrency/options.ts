import type { AvirxConcurrencyInput } from '../../types.js';

export function normalizeConcurrency(input: AvirxConcurrencyInput): number {
    if (!Number.isSafeInteger(input) || input < 1) {
        throw new TypeError('Concurrency limit must be a positive integer.');
    }

    return input;
}
