import { executeExpectedRequest, writeCacheResponse } from '../execution/orchestration.js';
import { parseBlobSafely } from './response.js';
import type { AvirxClientState, AvirxDownload, AvirxRequestState, AvirxResponse } from '../types.js';

export async function executeDownload(
    clientState: AvirxClientState,
    state: AvirxRequestState,
): Promise<AvirxDownload> {
    const response = await executeExpectedRequest(clientState, state);
    const blob = await parseBlobSafely(response.native);
    await writeCacheResponse(clientState, response);
    return createDownload(response, blob);
}

export function createDownload(response: AvirxResponse, blob: Blob): AvirxDownload {
    const download: {
        blob: Blob;
        contentLength?: number;
        contentType?: string;
        filename?: string;
        response: AvirxResponse;
        status: number;
    } = {
        blob,
        response,
        status: response.status,
    };

    const contentType = response.headers['content-type'] ?? blob.type;
    if (contentType) {
        download.contentType = contentType;
    }

    const contentLength = parseContentLength(response.headers['content-length']);
    if (contentLength !== undefined) {
        download.contentLength = contentLength;
    }

    const filename = parseContentDispositionFilename(response.headers['content-disposition']);
    if (filename !== undefined) {
        download.filename = filename;
    }

    return Object.freeze(download);
}

export function parseContentLength(value: string | undefined): number | undefined {
    if (value === undefined || !/^\d+$/u.test(value)) {
        return undefined;
    }

    const parsed = Number(value);
    return Number.isSafeInteger(parsed) ? parsed : undefined;
}

export function parseContentDispositionFilename(value: string | undefined): string | undefined {
    if (value === undefined) {
        return undefined;
    }

    const params = parseContentDispositionParams(value);
    const encoded = params.get('filename*');
    if (encoded !== undefined) {
        const decoded = decodeFilenameStar(encoded);
        if (decoded !== undefined) {
            return decoded;
        }
    }

    return params.get('filename');
}

function parseContentDispositionParams(value: string): ReadonlyMap<string, string> {
    const params: Map<string, string> = new Map();
    for (const part of splitContentDisposition(value).slice(1)) {
        const equals = part.indexOf('=');
        if (equals <= 0) {
            continue;
        }

        const key = part.slice(0, equals).trim().toLowerCase();
        const rawValue = part.slice(equals + 1).trim();
        if (key.length > 0) {
            params.set(key, unquoteHeaderValue(rawValue));
        }
    }

    return params;
}

function splitContentDisposition(value: string): string[] {
    const parts: string[] = [];
    let current = '';
    let quoted = false;

    for (let index = 0; index < value.length; index += 1) {
        const char = value[index];
        if (char === undefined) {
            continue;
        }

        if (quoted && char === '\\' && index + 1 < value.length) {
            const nextChar = value[index + 1];
            if (nextChar === undefined) {
                continue;
            }
            current += char;
            current += nextChar;
            index += 1;
            continue;
        }

        if (char === '"') {
            quoted = !quoted;
            current += char;
            continue;
        }

        if (char === ';' && !quoted) {
            parts.push(current.trim());
            current = '';
            continue;
        }

        current += char;
    }

    parts.push(current.trim());
    return parts;
}

function unquoteHeaderValue(value: string): string {
    if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
        return value.slice(1, -1).replace(/\\(["\\])/gu, '$1');
    }

    return value;
}

function decodeFilenameStar(value: string): string | undefined {
    const match = /^([^']*)'[^']*'(.*)$/u.exec(value);
    if (!match) {
        return undefined;
    }

    const charset = match[1]?.toLowerCase();
    const encoded = match[2];
    if (charset !== 'utf-8' || encoded === undefined) {
        return undefined;
    }

    try {
        return decodeURIComponent(encoded);
    } catch {
        return undefined;
    }
}
