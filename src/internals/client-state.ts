import { createPublicAuthState, getRawAuthPolicy, rememberRawAuthPolicy } from './state-redaction.js';
import { freezeRecord } from './freeze.js';
import type {
    AvirxAuthPolicy,
    AvirxCachePolicy,
    AvirxClientState,
    AvirxConcurrencyLimiter,
    AvirxHeaders,
    AvirxHookRegistry,
    AvirxRateLimitLimiter,
    AvirxRetryMetadata,
} from '../types.js';

interface MutableClientState {
    auth?: AvirxAuthPolicy;
    baseUrl: URL;
    cache?: AvirxCachePolicy;
    concurrency?: AvirxConcurrencyLimiter;
    fetch?: typeof fetch;
    headers: AvirxHeaders;
    hooks?: AvirxHookRegistry;
    name?: string;
    rateLimit?: AvirxRateLimitLimiter;
    retry?: AvirxRetryMetadata;
    signal?: AbortSignal;
    timeoutMs?: number;
}

type PublicClientStateSnapshot = {
    -readonly [Key in keyof AvirxClientState]?: AvirxClientState[Key];
};

export function createClientState(
    baseUrl: URL,
    options: Pick<AvirxClientState, 'fetch'> = {},
): AvirxClientState {
    const state: MutableClientState = {
        baseUrl: new URL(baseUrl.href),
        headers: Object.freeze({}),
    };

    if (options.fetch) {
        state.fetch = options.fetch;
    }

    return freezeClientState(state);
}

export function forkClientState(
    state: AvirxClientState,
    patch: Partial<{
        auth: AvirxAuthPolicy;
        cache: AvirxCachePolicy;
        concurrency: AvirxConcurrencyLimiter;
        fetch: typeof fetch;
        headers: AvirxHeaders;
        hooks: AvirxHookRegistry;
        name: string;
        rateLimit: AvirxRateLimitLimiter;
        retry: AvirxRetryMetadata;
        signal: AbortSignal;
        timeoutMs: number;
    }>,
): AvirxClientState {
    const next: MutableClientState = {
        baseUrl: state.baseUrl,
        headers: freezeRecord(patch.headers ?? state.headers),
    };

    const auth = patch.auth ?? getRawAuthPolicy(state);
    if (auth) {
        next.auth = auth;
    }

    const cache = patch.cache ?? state.cache;
    if (cache) {
        next.cache = cache;
    }

    const fetchImpl = patch.fetch ?? state.fetch;
    if (fetchImpl) {
        next.fetch = fetchImpl;
    }

    const concurrency = patch.concurrency ?? state.concurrency;
    if (concurrency) {
        next.concurrency = concurrency;
    }

    const hooks = patch.hooks ?? state.hooks;
    if (hooks) {
        next.hooks = hooks;
    }

    const name = patch.name ?? state.name;
    if (name) {
        next.name = name;
    }

    const rateLimit = patch.rateLimit ?? state.rateLimit;
    if (rateLimit) {
        next.rateLimit = rateLimit;
    }

    const retry = patch.retry ?? state.retry;
    if (retry) {
        next.retry = retry;
    }

    const signal = patch.signal ?? state.signal;
    if (signal) {
        next.signal = signal;
    }

    const timeoutMs = patch.timeoutMs ?? state.timeoutMs;
    if (timeoutMs !== undefined) {
        next.timeoutMs = timeoutMs;
    }

    return freezeClientState(next);
}

function freezeClientState(state: MutableClientState): AvirxClientState {
    const baseUrlHref = state.baseUrl.href;
    const snapshot: PublicClientStateSnapshot = {
        headers: state.headers,
    };

    Object.defineProperty(snapshot, 'baseUrl', {
        enumerable: true,
        get() {
            return new URL(baseUrlHref);
        },
    });

    if (state.auth) {
        snapshot.auth = createPublicAuthState(state.auth);
    }

    if (state.cache) {
        snapshot.cache = state.cache;
    }

    if (state.concurrency) {
        snapshot.concurrency = state.concurrency;
    }

    if (state.fetch) {
        snapshot.fetch = state.fetch;
    }

    if (state.hooks) {
        snapshot.hooks = state.hooks;
    }

    if (state.name) {
        snapshot.name = state.name;
    }

    if (state.rateLimit) {
        snapshot.rateLimit = state.rateLimit;
    }

    if (state.retry) {
        snapshot.retry = state.retry;
    }

    if (state.signal) {
        snapshot.signal = state.signal;
    }

    if (state.timeoutMs !== undefined) {
        snapshot.timeoutMs = state.timeoutMs;
    }

    const frozen = Object.freeze(snapshot) as AvirxClientState;
    rememberRawAuthPolicy(frozen, state.auth);

    return frozen;
}
