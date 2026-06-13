import type { AvirxHeaders } from '../types.js';

export function normalizeHeaders(input?: HeadersInit | AvirxHeaders): AvirxHeaders {
    assertNoUndefinedHeaderValues(input);

    const headers = new Headers(input);
    const normalized: Record<string, string> = {};

    headers.forEach((value, name) => {
        normalized[name.toLowerCase()] = value;
    });

    return Object.freeze(normalized);
}

export function normalizeHeader(name: string, value: string): AvirxHeaders {
    return normalizeHeaders([[name, value]]);
}

function assertNoUndefinedHeaderValues(input: unknown): void {
    if (!input || input instanceof Headers) {
        return;
    }

    if (Array.isArray(input)) {
        for (const entry of input) {
            if (Array.isArray(entry) && entry[1] === undefined) {
                throw new TypeError(`Header "${String(entry[0])}" cannot be undefined.`);
            }
        }
        return;
    }

    if (!isRecord(input)) {
        return;
    }

    for (const [name, value] of Object.entries(input)) {
        if (value === undefined) {
            throw new TypeError(`Header "${name}" cannot be undefined.`);
        }
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}
