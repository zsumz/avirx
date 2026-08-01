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
    const redacted: Record<string, string> = {};

    for (const [name, value] of Object.entries(normalized)) {
        redacted[name] = isSensitiveHeader(name) ? replacement : value;
    }

    return Object.freeze(redacted);
}

export function isSensitiveHeader(name: string): boolean {
    const normalized = name.trim().toLowerCase();
    return SENSITIVE_HEADER_NAMES.has(normalized) || normalized.includes('api-key');
}
