import { AvirxError } from '../error/avirx-error.js';
import {
    createUnexpectedStatusError,
    executeExpectedRequest,
    executeRequest,
    readJsonBody,
    runErrorHooks,
    runTerminalErrorHooks,
    writeCacheResponse,
} from '../execution/orchestration.js';
import { parseTextSafely } from './response.js';
import { parseWithSchema } from '../contract/schema.js';
import { mergeHooks } from '../policy/hooks/hooks.js';
import { isExpectedStatus } from '../transport/status.js';
import type {
    AvirxClientState,
    AvirxInferSchema,
    AvirxRequestState,
    AvirxResponse,
    AvirxResult,
    AvirxSchema,
} from '../types.js';

export async function executeAs<Schema extends AvirxSchema<unknown>>(
    clientState: AvirxClientState,
    state: AvirxRequestState,
    schema: Schema,
): Promise<AvirxInferSchema<Schema>> {
    const response = await executeExpectedRequest(clientState, state);
    let data: unknown;

    try {
        data = await parseJsonForTerminal(response);
    } catch (error) {
        if (error instanceof AvirxError) {
            await runTerminalErrorHooks(clientState, state, error, response);
        }
        throw error;
    }

    try {
        const parsed = parseWithSchema(schema, data);
        await writeCacheResponse(clientState, response);
        return parsed;
    } catch (cause) {
        const wrappedError = createValidationError(response, data, cause);
        await runTerminalErrorHooks(clientState, state, wrappedError, response);
        throw wrappedError;
    }
}

export async function executeJson<T = unknown>(
    clientState: AvirxClientState,
    state: AvirxRequestState,
): Promise<T> {
    const response = await executeExpectedRequest(clientState, state);
    if (response.status === 204 || response.status === 205) {
        await writeCacheResponse(clientState, response);
        return undefined as T;
    }

    try {
        const data = (await parseJsonForTerminal(response)) as T;
        await writeCacheResponse(clientState, response);
        return data;
    } catch (error) {
        if (error instanceof AvirxError) {
            await runTerminalErrorHooks(clientState, state, error, response);
        }
        throw error;
    }
}

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
        const hooks = mergeHooks(clientState.hooks, state.hooks);
        const error = await createUnexpectedStatusError(
            response,
            state.errorSchema as AvirxSchema<ErrorData> | undefined,
        );
        await runErrorHooks(hooks, error, response);
        return createErrorResult(error);
    }

    try {
        const data = await parseResultData(response, schema);
        await writeCacheResponse(clientState, response);
        return {
            data,
            ok: true,
            response,
            status: response.status,
        };
    } catch (error) {
        if (error instanceof AvirxError) {
            await runTerminalErrorHooks(clientState, state, error, response);
            return createErrorResult(error as AvirxError<ErrorData>);
        }

        const wrappedError = new AvirxError('Result processing failed.', {
            cause: error,
            request: response.request,
            response,
            status: response.status,
        });
        await runTerminalErrorHooks(clientState, state, wrappedError, response);
        return createErrorResult(wrappedError as AvirxError<ErrorData>);
    }
}

export async function executeSend(
    clientState: AvirxClientState,
    state: AvirxRequestState,
): Promise<AvirxResponse> {
    const response = await executeExpectedRequest(clientState, state);
    await writeCacheResponse(clientState, response);
    return response;
}

export async function executeText(
    clientState: AvirxClientState,
    state: AvirxRequestState,
): Promise<string> {
    const response = await executeExpectedRequest(clientState, state);
    const data = await parseTextSafely(response.native);
    await writeCacheResponse(clientState, response);
    return data;
}

async function parseResultData(
    response: AvirxResponse,
    schema: AvirxSchema<unknown> | undefined,
): Promise<unknown> {
    const data = await parseJsonForTerminal(response);
    if (!schema) {
        return data;
    }

    try {
        return parseWithSchema(schema, data);
    } catch (cause) {
        throw createValidationError(response, data, cause);
    }
}

async function parseJsonForTerminal(response: AvirxResponse): Promise<unknown> {
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

function createValidationError(
    response: AvirxResponse,
    data: unknown,
    cause: unknown,
): AvirxError {
    return new AvirxError(
        data === undefined
            ? 'Response validation failed for empty response body.'
            : 'Response validation failed.',
        {
            cause,
            request: response.request,
            response,
            status: response.status,
        },
    );
}

function createErrorResult<ErrorData>(
    error: AvirxError<ErrorData>,
): Extract<AvirxResult<unknown, ErrorData>, { ok: false }> {
    const result: {
        error: AvirxError<ErrorData>;
        ok: false;
        response?: AvirxResponse<ErrorData>;
        status?: number;
    } = {
        error,
        ok: false,
    };

    if (error.status !== undefined) {
        result.status = error.status;
    }
    if (error.response !== undefined) {
        result.response = error.response as AvirxResponse<ErrorData>;
    }

    return result;
}
