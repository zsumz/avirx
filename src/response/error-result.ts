import type { AvirxError } from '../error/avirx-error.js';
import type { AvirxResponse, AvirxResult } from '../types.js';

export function createErrorResult<ErrorData>(
    error: AvirxError<ErrorData>,
): Extract<AvirxResult<unknown, ErrorData>, { ok: false }> {
    const result: {
        error: AvirxError<ErrorData>;
        ok: false;
        response?: AvirxResponse<ErrorData>;
        status?: number;
    } = { error, ok: false };
    if (error.status !== undefined) {
        result.status = error.status;
    }
    if (error.response !== undefined) {
        result.response = error.response as AvirxResponse<ErrorData>;
    }
    return result;
}
