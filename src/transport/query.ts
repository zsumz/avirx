import type { AvirxPrimitiveValue, AvirxQueryInput, AvirxQueryValue } from '../types.js';

export function normalizeQuery(input: AvirxQueryInput): Readonly<Record<string, AvirxQueryValue>> {
    if (input instanceof URLSearchParams) {
        return normalizeSearchParams(input);
    }

    return Object.freeze(Object.fromEntries(
        Object.entries(input)
            .filter(([, value]) => value !== null && value !== undefined)
            .map(([key, value]) => [key, isQueryArray(value) ? Object.freeze([...value]) : value]),
    ));
}

export function serializeQuery(input: AvirxQueryInput): URLSearchParams {
    const params = new URLSearchParams();

    if (input instanceof URLSearchParams) {
        input.forEach((value, key) => {
            params.append(key, value);
        });
        return params;
    }

    for (const [key, value] of Object.entries(input)) {
        appendQueryValue(params, key, value);
    }

    return params;
}

export function appendQuery(url: URL, input: AvirxQueryInput): URL {
    const next = new URL(url.href);
    const params = serializeQuery(input);

    params.forEach((value, key) => {
        next.searchParams.append(key, value);
    });

    return next;
}

function appendQueryValue(params: URLSearchParams, key: string, value: AvirxQueryValue): void {
    if (value === null || value === undefined) {
        return;
    }

    if (isQueryArray(value)) {
        for (const item of value) {
            params.append(key, stringifyQueryPrimitive(item));
        }
        return;
    }

    params.append(key, stringifyQueryPrimitive(value));
}

function normalizeSearchParams(params: URLSearchParams): Readonly<Record<string, AvirxQueryValue>> {
    const normalized: Map<string, AvirxQueryValue> = new Map();
    params.forEach((value, key) => {
        const existing = normalized.get(key);
        normalized.set(key, existing === undefined || existing === null
            ? value
            : isQueryArray(existing) ? [...existing, value] : [existing, value]);
    });
    return normalizeQuery(Object.fromEntries(normalized));
}

function stringifyQueryPrimitive(value: AvirxPrimitiveValue): string {
    return String(value);
}

function isQueryArray(value: AvirxQueryValue): value is readonly AvirxPrimitiveValue[] {
    return Array.isArray(value);
}
