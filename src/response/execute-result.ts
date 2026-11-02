import { AvirxError } from '../error/avirx-error.js';
import { writeCacheResponse } from '../execution/cache.js';
import { createUnexpectedStatusError } from '../execution/errors.js';
import { runErrorHooks, runTerminalErrorHooks } from '../execution/hooks.js';
import { executeRequest } from '../execution/retry.js';
import { mergeHooks } from '../policy/hooks/hooks.js';
import { isExpectedStatus } from '../transport/status.js';
import { parseWithSchema } from '../contract/schema.js';
import { createErrorResult } from './error-result.js';
import { createValidationError, readTerminalJson } from './terminal-json.js';
import type {
    AvirxClientState,
    AvirxRequestState,
    AvirxResponse,
    AvirxResult,
    AvirxSchema,
} from '../types.js';

export async function executeResult<ErrorData>(
    clientState: AvirxClientState,
    state: AvirxRequestState,
    schema?: AvirxSchema<unknown>,
): Promise<AvirxResult<unknown, ErrorData>> {
    let response: AvirxResponse;
    try {
        response = await executeRequest(clientState, state);
    } catch (error) {
        if (error instanceof AvirxError) {
            return createErrorResult(error as AvirxError<ErrorData>);
        }
        throw error;
    }
    if (!isExpectedStatus(response.status, state.expectedStatuses)) {
        return handleUnexpectedStatus(clientState, state, response);
    }
    try {
        const data = await parseResultData(response, schema);
        await writeCacheResponse(clientState, response);
        return { data, ok: true, response, status: response.status };
    } catch (error) {
        return handleResultError(clientState, state, response, error);
    }
}

async function handleUnexpectedStatus<ErrorData>(
    clientState: AvirxClientState,
    state: AvirxRequestState,
    response: AvirxResponse,
): Promise<Extract<AvirxResult<unknown, ErrorData>, { ok: false }>> {
    const hooks = mergeHooks(clientState.hooks, state.hooks);
    const error = await createUnexpectedStatusError(
        response,
        state.errorSchema as AvirxSchema<ErrorData> | undefined,
    );
    await runErrorHooks(hooks, error, response);
    return createErrorResult(error);
}

async function parseResultData(
    response: AvirxResponse,
    schema: AvirxSchema<unknown> | undefined,
): Promise<unknown> {
    const data = await readTerminalJson(response);
    if (!schema) return data;
    try {
        return await parseWithSchema(schema, data);
    } catch (cause) {
        throw createValidationError(response, data, cause);
    }
}

async function handleResultError<ErrorData>(
    clientState: AvirxClientState,
    state: AvirxRequestState,
    response: AvirxResponse,
    cause: unknown,
): Promise<Extract<AvirxResult<unknown, ErrorData>, { ok: false }>> {
    const error = cause instanceof AvirxError
        ? cause
        : new AvirxError('Result processing failed.', {
            cause,
            kind: 'decode',
            request: response.request,
            response,
            status: response.status,
        });
    await runTerminalErrorHooks(clientState, state, error, response);
    return createErrorResult(error as AvirxError<ErrorData>);
}
