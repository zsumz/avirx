import { buildRequest } from '../request/build-request.js';
import { resolveEffectiveAuth } from '../request/effective-auth.js';
import { AvirxError } from '../error/avirx-error.js';
import {
    createAbortScope,
    createRequestFailureMessage,
    createTimeoutSignal,
    throwIfAborted,
} from '../transport/abort.js';
import { completeRequestAttempt } from './complete-attempt.js';
import { createFetchInit } from './fetch-init.js';
import { createHookContext, runErrorHooks } from './hooks.js';
import { acquireRequestBudget } from './request-budget.js';
import { registerResponseDisposal } from './response-disposal.js';
import { runHooks } from '../policy/hooks/hooks.js';
import type {
    AvirxClientState,
    AvirxHookRegistry,
    AvirxRequestState,
    AvirxResponse,
    AvirxRetryEvent,
} from '../types.js';

export async function executeRequestAttempt(
    clientState: AvirxClientState,
    state: AvirxRequestState,
    retryEvents: readonly AvirxRetryEvent[],
    hooks: AvirxHookRegistry,
    externalSignal: AbortSignal | undefined,
): Promise<AvirxResponse> {
    const built = buildRequest(
        clientState,
        state,
        await resolveEffectiveAuth(clientState, state),
    );
    const fetchImpl = clientState.fetch ?? globalThis.fetch;
    let release = (): void => undefined;
    let startedAt = Date.now();
    let timeout = createTimeoutSignal(undefined);
    let fetchAbort = createAbortScope([]);
    let native: Response | undefined;
    let requestError: AvirxError | undefined;
    const responseController = new AbortController();

    try {
        throwIfAborted(built, externalSignal);

        const cached = clientState.cache?.get(built);
        if (cached) {
            return cached;
        }

        await runHooks(hooks, 'request', createHookContext(built));
        throwIfAborted(built, externalSignal);
        release = await acquireRequestBudget(clientState, built, externalSignal);
        startedAt = Date.now();
        timeout = createTimeoutSignal(built.timeoutMs);
        fetchAbort = createAbortScope([externalSignal, timeout.signal, responseController.signal]);
        throwIfAborted(built, fetchAbort.signal);

        native = await fetchImpl(built.url, createFetchInit(built, fetchAbort.signal));
        registerResponseDisposal(native, responseController);
    } catch (cause) {
        requestError = cause instanceof AvirxError
            ? cause
            : new AvirxError(createRequestFailureMessage(timeout.signal, externalSignal), {
                cause: externalSignal?.aborted ? externalSignal.reason : cause,
                request: built,
            });
    } finally {
        timeout.cancel();
        fetchAbort.cancel();
        release();
    }

    if (requestError) {
        await runErrorHooks(hooks, requestError);
        throw requestError;
    }
    if (!native) {
        throw new AvirxError('Request failed.', { request: built });
    }

    return completeRequestAttempt(
        native,
        built,
        startedAt,
        retryEvents,
        hooks,
    );
}
