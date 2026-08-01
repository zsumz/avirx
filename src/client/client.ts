import {
    createApiKeyHeaderAuth,
    createApiKeyQueryAuth,
    createBasicAuth,
    createBearerAuth,
} from '../policy/auth/auth.js';
import { createCachePolicy } from '../policy/cache/cache.js';
import { createConcurrencyLimiter } from '../policy/concurrency/concurrency.js';
import { normalizeDurationMs } from '../time/duration.js';
import { createContractClient } from '../contract/contract.js';
import { normalizeHeader, normalizeHeaders } from '../transport/headers.js';
import { appendHook } from '../policy/hooks/hooks.js';
import { createClientState, forkClientState } from './state/client-state.js';
import { createRateLimitLimiter } from '../policy/rate-limit/rate-limit.js';
import { normalizeRetry } from '../policy/retry/retry.js';
import { createRequestBuilder } from '../request/create-request-builder.js';
import type {
    AvirxAuthTokenProvider,
    AvirxClient,
    AvirxClientOptions,
    AvirxHookEvent,
    AvirxHookHandler,
    AvirxRetryInput,
} from '../types.js';

export function avirx(baseUrl: string, options: AvirxClientOptions = {}): AvirxClient {
    return createClient(createClientState(new URL(baseUrl), options));
}

function createClient(state: AvirxClient['state']): AvirxClient {
    return Object.freeze({
        auth: Object.freeze({
            apiKey(name: string, key: AvirxAuthTokenProvider) {
                return createClient(forkClientState(state, { auth: createApiKeyHeaderAuth(name, key) }));
            },
            basic(username: string, password: string) {
                return createClient(forkClientState(state, { auth: createBasicAuth(username, password) }));
            },
            bearer(token: AvirxAuthTokenProvider) {
                return createClient(forkClientState(state, { auth: createBearerAuth(token) }));
            },
            query(name: string, key: AvirxAuthTokenProvider) {
                return createClient(forkClientState(state, { auth: createApiKeyQueryAuth(name, key) }));
            },
        }),
        cache(input) {
            return createClient(forkClientState(state, { cache: createCachePolicy(input) }));
        },
        concurrency(input) {
            return createClient(forkClientState(state, { concurrency: createConcurrencyLimiter(input) }));
        },
        contract(contract) {
            return createContractClient(state, contract);
        },
        delete(route) {
            return createRequestBuilder(state, 'DELETE', route);
        },
        get(route) {
            return createRequestBuilder(state, 'GET', route);
        },
        head(route) {
            return createRequestBuilder(state, 'HEAD', route);
        },
        header(name, value) {
            return createClient(
                forkClientState(state, {
                    headers: {
                        ...state.headers,
                        ...normalizeHeader(name, value),
                    },
                }),
            );
        },
        headers(headers) {
            return createClient(
                forkClientState(state, {
                    headers: {
                        ...state.headers,
                        ...normalizeHeaders(headers),
                    },
                }),
            );
        },
        name(name) {
            return createClient(forkClientState(state, { name }));
        },
        on(event: AvirxHookEvent, handler: AvirxHookHandler) {
            return createClient(forkClientState(state, { hooks: appendHook(state.hooks, event, handler) }));
        },
        options(route) {
            return createRequestBuilder(state, 'OPTIONS', route);
        },
        patch(route) {
            return createRequestBuilder(state, 'PATCH', route);
        },
        post(route) {
            return createRequestBuilder(state, 'POST', route);
        },
        put(route) {
            return createRequestBuilder(state, 'PUT', route);
        },
        rateLimit(input) {
            return createClient(forkClientState(state, { rateLimit: createRateLimitLimiter(input) }));
        },
        retry(input: AvirxRetryInput) {
            return createClient(forkClientState(state, { retry: normalizeRetry(input) }));
        },
        signal(signal) {
            return createClient(forkClientState(state, { signal }));
        },
        state,
        timeout(duration) {
            return createClient(forkClientState(state, { timeoutMs: normalizeDurationMs(duration) }));
        },
    });
}
