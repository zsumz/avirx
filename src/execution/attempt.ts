import { buildRequest } from '../request/build-request.js';
import { resolveEffectiveAuth } from '../request/effective-auth.js';
import { AvirxError } from '../error/avirx-error.js';
import { CallbackFailure, callCallback } from '../error/callback-failure.js';
import {
    createAbortScope,
    createTimeoutSignal,
    throwIfAborted,
} from '../transport/abort.js';
import { completeRequestAttempt } from './complete-attempt.js';
import { createFetchInit } from './fetch-init.js';
import { createHookContext, runErrorHooks } from './hooks.js';
import { acquireRequestBudget } from './request-budget.js';
import { registerResponseDisposal } from './response-disposal.js';
import { createRequestFailure } from './request-failure.js';
import { registerCacheResponse, type CacheWrite } from '../policy/cache/invalidation.js';
import { elapsedNow } from '../time/clock.js';
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
    cacheWrite?: CacheWrite,
): Promise<AvirxResponse> {
    const built = buildRequest(
        clientState,
        state,
        await callCallback(async () => resolveEffectiveAuth(clientState, state)),
    );
    const fetchImpl = clientState.fetch ?? globalThis.fetch;
    let release = (): void => undefined;
    let startedAt = Date.now();
    let startedElapsedAt = elapsedNow();
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
        startedElapsedAt = elapsedNow();
        timeout = createTimeoutSignal(built.timeoutMs);
        fetchAbort = createAbortScope([externalSignal, timeout.signal, responseController.signal]);
        throwIfAborted(built, fetchAbort.signal);

        const init = createFetchInit(built, fetchAbort.signal, clientState.allowCredentialRedirects);
        native = await fetchImpl(built.url, init);
        registerResponseDisposal(native, responseController, fetchAbort.signal);
    } catch (cause) {
        if (cause instanceof CallbackFailure) throw cause;
        requestError = createRequestFailure(cause, built, timeout.signal, externalSignal, fetchAbort.signal);
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
        throw new AvirxError('Request failed.', { kind: 'network', request: built });
    }

    const response = await completeRequestAttempt(
        native,
        built,
        startedAt,
        startedElapsedAt,
        retryEvents,
        hooks,
    );
    registerCacheResponse(response, cacheWrite);
    return response;
}
