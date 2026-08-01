import { AvirxError } from '../error/avirx-error.js';
import { createAbortScope, delay } from '../transport/abort.js';
import { mergeHooks, runHooks } from '../policy/hooks/hooks.js';
import { executeRequestAttempt } from './attempt.js';
import { createHookContext, runErrorHooks } from './hooks.js';
import { createRetryEvent, shouldRetryResponse } from './retry-decision.js';
import type {
    AvirxClientState,
    AvirxRequestState,
    AvirxResponse,
    AvirxRetryEvent,
} from '../types.js';

export async function executeRequest(
    clientState: AvirxClientState,
    state: AvirxRequestState,
): Promise<AvirxResponse> {
    const hooks = mergeHooks(clientState.hooks, state.hooks);
    const externalAbort = createAbortScope([clientState.signal, state.signal]);
    const retryEvents: AvirxRetryEvent[] = [];
    let attempt = 0;

    try {
        for (;;) {
            const response = await executeRequestAttempt(clientState, state, retryEvents, hooks, externalAbort.signal);
            if (!shouldRetryResponse(response, state, attempt)) {
                return response;
            }

            attempt += 1;
            const event = createRetryEvent(attempt, response);
            retryEvents.push(event);
            await runHooks(hooks, 'retry', createHookContext(response.request, { response, retry: event }));
            try {
                await delay(event.delayMs, externalAbort.signal, response.request);
            } catch (error) {
                if (error instanceof AvirxError) {
                    await runErrorHooks(hooks, error);
                }
                throw error;
            }
        }
    } finally {
        externalAbort.cancel();
    }
}
