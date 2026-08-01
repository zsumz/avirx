import { AvirxError } from '../error/avirx-error.js';
import { readJsonResponse } from '../response/read-response.js';
import { parseWithSchema } from '../contract/schema.js';
import type { AvirxResponse, AvirxSchema } from '../types.js';

export async function createUnexpectedStatusError<ErrorData>(
    response: AvirxResponse,
    schema: AvirxSchema<ErrorData> | undefined,
): Promise<AvirxError<ErrorData>> {
    const message = `Unexpected HTTP status ${String(response.status)}.`;
    const options = {
        request: response.request,
        response,
        status: response.status,
    };

    if (!schema) {
        return new AvirxError(message, options);
    }

    try {
        return new AvirxError(message, {
            ...options,
            data: parseWithSchema(schema, await readJsonBody(response)),
        });
    } catch (cause) {
        return new AvirxError(message, {
            ...options,
            cause,
        });
    }
}

export async function readJsonBody(response: AvirxResponse): Promise<unknown> {
    if (response.status === 204 || response.status === 205) {
        return undefined;
    }

    return readJsonResponse(response.native);
}
