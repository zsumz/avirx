import type { AvirxPrimitiveValue, AvirxQueryInput, AvirxQueryValue } from '../types.js';

export function normalizeQuery(input: AvirxQueryInput): Readonly<Record<string, AvirxQueryValue>> {
    if (input instanceof URLSearchParams) {
        return normalizeSearchParams(input);
    }

    const normalized: Record<string, AvirxQueryValue> = {};
    for (const [key, value] of Object.entries(input)) {
        if (value === null || value === undefined) {
            continue;
        }
        normalized[key] = isQueryArray(value) ? [...value] : value;
    }

    return Object.freeze(normalized);
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
    const normalized: Record<string, AvirxQueryValue> = {};

    params.forEach((value, key) => {
        const existing = normalized[key];
        if (existing === undefined) {
            normalized[key] = value;
            return;
        }

        if (existing === null) {
            normalized[key] = value;
            return;
        }

        normalized[key] = isQueryArray(existing) ? [...existing, value] : [existing, value];
    });

    return Object.freeze(normalized);
}

function stringifyQueryPrimitive(value: AvirxPrimitiveValue): string {
    return String(value);
}

function isQueryArray(value: AvirxQueryValue): value is readonly AvirxPrimitiveValue[] {
    return Array.isArray(value);
}
