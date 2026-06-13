import { isSensitiveHeader } from './redact.js';
import type { AvirxBuiltRequest, AvirxHeaders } from '../types.js';

export function createCacheKey(request: AvirxBuiltRequest, vary: readonly string[]): string {
    const parts = [request.method, request.url.href];

    for (const header of vary) {
        parts.push(header, request.headers[header] ?? '');
    }

    return JSON.stringify(parts);
}

export function hasSensitiveHeaders(headers: AvirxHeaders): boolean {
    return Object.keys(headers).some(isSensitiveHeader);
}
