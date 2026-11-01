import { getRawAuthPolicy } from '../../policy/auth/state-redaction.js';
import { freezeRecord } from '../../state/freeze.js';
import { freezeClientState } from './freeze-client-state.js';
import type { ClientStatePatch, MutableClientState } from './client-state-types.js';
import type { AvirxClientState } from '../../types.js';

export function forkClientState(
    state: AvirxClientState,
    patch: ClientStatePatch,
): AvirxClientState {
    const next: MutableClientState = {
        baseUrl: state.baseUrl,
        headers: freezeRecord(patch.headers ?? state.headers),
    };
    const auth = patch.auth ?? getRawAuthPolicy(state);
    if (auth) {
        next.auth = auth;
    }
    copyOptionalClientState(next, state, patch);
    return freezeClientState(next);
}

function copyOptionalClientState(
    next: MutableClientState,
    state: AvirxClientState,
    patch: ClientStatePatch,
): void {
    const allowCredentialRedirects = patch.allowCredentialRedirects ?? state.allowCredentialRedirects;
    if (allowCredentialRedirects !== undefined) next.allowCredentialRedirects = allowCredentialRedirects;
    const cache = patch.cache ?? state.cache;
    if (cache) next.cache = cache;
    const fetchImpl = patch.fetch ?? state.fetch;
    if (fetchImpl) next.fetch = fetchImpl;
    const concurrency = patch.concurrency ?? state.concurrency;
    if (concurrency) next.concurrency = concurrency;
    const hooks = patch.hooks ?? state.hooks;
    if (hooks) next.hooks = hooks;
    const name = patch.name ?? state.name;
    if (name) next.name = name;
    const rateLimit = patch.rateLimit ?? state.rateLimit;
    if (rateLimit) next.rateLimit = rateLimit;
    const retry = patch.retry ?? state.retry;
    if (retry) next.retry = retry;
    const signal = patch.signal ?? state.signal;
    if (signal) next.signal = signal;
    const timeoutMs = patch.timeoutMs ?? state.timeoutMs;
    if (timeoutMs !== undefined) next.timeoutMs = timeoutMs;
}
