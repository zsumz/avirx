import { normalizeHeaders } from '../transport/headers.js';
import type {
    AvirxBuiltRequest,
    AvirxResponse,
    AvirxTimingMetadata,
} from '../types.js';

export function createAvirxResponse(
    native: Response,
    request: AvirxBuiltRequest,
    timing: AvirxTimingMetadata,
): AvirxResponse {
    return Object.freeze({
        headers: normalizeHeaders(native.headers),
        native,
        ok: native.ok,
        request,
        status: native.status,
        statusText: native.statusText,
        timing,
        url: native.url || request.url.href,
    });
}
