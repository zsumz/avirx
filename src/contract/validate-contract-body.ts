import { isPlainRecord } from './plain-record.js';
import type { AvirxBodyValue } from '../types.js';

export function validateContractBody(value: unknown): AvirxBodyValue {
    if (isBodyValue(value)) {
        return value;
    }

    throw new TypeError('Contract body schema must parse to a supported request body value.');
}

function isBodyValue(value: unknown): value is AvirxBodyValue {
    return value === null
    || value === undefined
    || typeof value === 'string'
    || value instanceof ArrayBuffer
    || value instanceof Blob
    || value instanceof FormData
    || value instanceof ReadableStream
    || value instanceof URLSearchParams
    || Array.isArray(value)
    || isPlainRecord(value);
}
