import { AvirxError } from './errors.js';
import { createAbortScope, delay } from './internals/abort.js';
import { mergeHooks, runHooks } from './internals/hooks.js';
import { calculateRetryDelayMs, canRetryMethod } from './internals/retry.js';
import { isExpectedStatus } from './internals/status.js';
import { executeRequestAttempt } from './execution-attempt.js';
import { createHookContext, runErrorHooks } from './execution-hooks.js';
import type {
    AvirxClientState,
    AvirxRequestState,
    AvirxResponse,
    AvirxRetryEvent,
} from './types.js';

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
            const retry = response.request.retry;

            if (!retry || attempt >= retry.attempts) {
                return response;
            }

            if (isExpectedStatus(response.status, state.expectedStatuses)) {
                return response;
            }

            if (!retry.on.includes(response.status)) {
                return response;
            }

            if (!canRetryMethod(response.request.method, retry) || !canReplayBody(response.request)) {
                return response;
            }

            attempt += 1;
            const event = Object.freeze({
                attempt,
                delayMs: calculateRetryDelayMs(attempt, response.headers['retry-after']),
                status: response.status,
            });
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

function canReplayBody(request: AvirxResponse['request']): boolean {
    if (!('body' in request)) {
        return true;
    }

    return request.bodyMetadata.kind !== 'form' && request.bodyMetadata.kind !== 'stream';
}
