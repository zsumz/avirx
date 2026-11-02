import { isSensitiveHeader } from '../../transport/redact.js';
import type { AvirxBuiltRequest, AvirxHeaders } from '../../types.js';

export function createCacheKey(request: AvirxBuiltRequest, vary: readonly string[]): string {
    const parts: Array<string | null> = [request.method, request.url.href];

    for (const header of vary) {
        parts.push(header, request.headers[header] ?? null);
    }

    return JSON.stringify(parts);
}

export function hasSensitiveHeaders(headers: AvirxHeaders): boolean {
    return Object.keys(headers).some(isSensitiveHeader);
}
