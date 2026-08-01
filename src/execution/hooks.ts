import type { AvirxError } from '../error/avirx-error.js';
import { mergeHooks, runHooks } from '../policy/hooks/hooks.js';
import type {
    AvirxClientState,
    AvirxHookContext,
    AvirxHookRegistry,
    AvirxRequestState,
    AvirxResponse,
    AvirxRetryEvent,
} from '../types.js';

export async function runTerminalErrorHooks(
    clientState: AvirxClientState,
    state: AvirxRequestState,
    error: AvirxError,
    response: AvirxResponse,
): Promise<void> {
    await runErrorHooks(mergeHooks(clientState.hooks, state.hooks), error, response);
}

export async function runErrorHooks(
    hooks: AvirxHookRegistry,
    error: AvirxError,
    response?: AvirxResponse,
): Promise<void> {
    const values = response ? { error, response } : { error };
    await runHooks(
        hooks,
        'error',
        createHookContext(response?.request ?? error.request, values),
    );
}

export function createHookContext(
    request: AvirxResponse['request'],
    values: {
        error?: AvirxError;
        response?: AvirxResponse;
        retry?: AvirxRetryEvent;
    } = {},
): AvirxHookContext {
    return Object.freeze({
        error: () => values.error,
        request: () => request,
        response: () => values.response,
        retry: () => values.retry,
    });
}
