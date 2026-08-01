import { buildRequest } from '../request/build-request.js';
import { resolveEffectiveAuth } from '../request/effective-auth.js';
import { toFetchBody } from '../request/fetch-body.js';
import { AvirxError } from '../error/avirx-error.js';
import {
    createAbortScope,
    createRequestFailureMessage,
    createTimeoutSignal,
    throwIfAborted,
} from '../transport/abort.js';
import { createAvirxResponse } from '../response/response.js';
import { createHookContext, runErrorHooks } from './hooks.js';
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
    let release: () => void = noop;
    let startedAt = Date.now();
    let timeout = createTimeoutSignal(undefined);
    let fetchAbort = createAbortScope([]);
    let native: Response | undefined;
    let requestError: AvirxError | undefined;

    try {
        throwIfAborted(built, externalSignal);

        const cached = clientState.cache?.get(built);
        if (cached) {
            return cached;
        }

        await acquireRateLimitBudget(clientState, built, externalSignal);
        release = await acquireConcurrencySlot(clientState, externalSignal);
        startedAt = Date.now();
        timeout = createTimeoutSignal(built.timeoutMs);
        fetchAbort = createAbortScope([externalSignal, timeout.signal]);
        throwIfAborted(built, fetchAbort.signal);
        await runHooks(hooks, 'request', createHookContext(built));

        native = await fetchImpl(built.url, createFetchInit(built, fetchAbort.signal));
    } catch (cause) {
        requestError = cause instanceof AvirxError
            ? cause
            : new AvirxError(createRequestFailureMessage(timeout.signal, externalSignal), {
                cause,
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

    const endedAt = Date.now();
    const timing = {
        durationMs: endedAt - startedAt,
        endedAt,
        startedAt,
    };

    const response = createAvirxResponse(
        native,
        built,
        Object.freeze({
            ...timing,
            ...retryEvents.length > 0 ? { retryEvents: Object.freeze([...retryEvents]) } : {},
        }),
    );
    await runHooks(hooks, 'response', createHookContext(built, { response }));
    return response;
}

function createFetchInit(
    request: AvirxResponse['request'],
    signal: AbortSignal | undefined,
): RequestInit {
    const init: RequestInit = {
        headers: request.headers,
        method: request.method,
    };

    if ('body' in request) {
        const body = toFetchBody(request.body);
        if (body !== undefined) {
            init.body = body;
        }
    }
    if (signal) {
        init.signal = signal;
    }

    return init;
}

async function acquireRateLimitBudget(
    clientState: AvirxClientState,
    request: AvirxResponse['request'],
    signal: AbortSignal | undefined,
): Promise<void> {
    if (!clientState.rateLimit) {
        return;
    }

    await clientState.rateLimit.acquire(request, signal);
}

async function acquireConcurrencySlot(
    clientState: AvirxClientState,
    signal: AbortSignal | undefined,
): Promise<() => void> {
    if (!clientState.concurrency) {
        return noop;
    }

    return clientState.concurrency.acquire(signal);
}

function noop(): void {
    return;
}
