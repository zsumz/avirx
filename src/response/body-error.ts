import { AvirxError } from '../error/avirx-error.js';
import { getResponseAbortSignal } from '../execution/response-disposal.js';
import type { AvirxResponse } from '../types.js';

export function createBodyError(response: AvirxResponse, message: string, cause: unknown): AvirxError {
    const signal = getResponseAbortSignal(response.native);
    return new AvirxError(signal?.aborted ? 'Request aborted.' : message, {
        cause: signal?.aborted ? signal.reason : cause,
        kind: signal?.aborted ? 'aborted' : 'decode',
        request: response.request,
        response,
        status: response.status,
    });
}
