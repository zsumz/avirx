import { isPlainRecord } from './plain-record.js';
import type { AvirxPrimitiveValue, AvirxQueryInput } from '../types.js';

export function validateContractQuery(value: unknown): AvirxQueryInput {
    if (value instanceof URLSearchParams) {
        return value;
    }
    if (!isPlainRecord(value)) {
        throw new TypeError('Contract query schema must parse to URLSearchParams or a query object.');
    }

    for (const [name, queryValue] of Object.entries(value)) {
        if (queryValue === null || queryValue === undefined) {
            continue;
        }
        if (Array.isArray(queryValue)) {
            if (queryValue.some((item) => !isPrimitiveValue(item))) {
                throw new TypeError(
                    `Contract query value "${name}" must be a primitive or an array of primitives.`,
                );
            }
            continue;
        }
        if (!isPrimitiveValue(queryValue)) {
            throw new TypeError(
                `Contract query value "${name}" must be a primitive or an array of primitives.`,
            );
        }
    }

    return value as AvirxQueryInput;
}

function isPrimitiveValue(value: unknown): value is AvirxPrimitiveValue {
    return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}
