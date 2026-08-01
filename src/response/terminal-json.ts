import { AvirxError } from '../error/avirx-error.js';
import { readJsonBody } from '../execution/errors.js';
import type { AvirxResponse } from '../types.js';

export async function readTerminalJson(response: AvirxResponse): Promise<unknown> {
    try {
        return await readJsonBody(response);
    } catch (cause) {
        throw new AvirxError('Failed to parse response JSON.', {
            cause,
            request: response.request,
            response,
            status: response.status,
        });
    }
}

export function createValidationError(
    response: AvirxResponse,
    data: unknown,
    cause: unknown,
): AvirxError {
    const message = data === undefined
        ? 'Response validation failed for empty response body.'
        : 'Response validation failed.';
    return new AvirxError(message, {
        cause,
        request: response.request,
        response,
        status: response.status,
    });
}
