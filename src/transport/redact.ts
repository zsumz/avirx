import type { AvirxHeaders } from '../types.js';
import { normalizeHeaders } from './headers.js';

const SENSITIVE_HEADER_NAMES = new Set([
    'authorization',
    'cookie',
    'proxy-authorization',
    'set-cookie',
    'x-api-key',
]);

export function redactHeaders(
    headers: HeadersInit | AvirxHeaders,
    replacement = '[redacted]',
): AvirxHeaders {
    const normalized = normalizeHeaders(headers);
    return Object.freeze(Object.fromEntries(
        Object.entries(normalized).map(([name, value]) => [
            name,
            isSensitiveHeader(name) ? replacement : value,
        ]),
    ));
}

export function isSensitiveHeader(name: string): boolean {
    const normalized = name.trim().toLowerCase();
    return SENSITIVE_HEADER_NAMES.has(normalized) || normalized.includes('api-key');
}
