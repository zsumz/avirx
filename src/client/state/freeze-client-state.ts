import {
    createPublicAuthState,
    rememberRawAuthPolicy,
} from '../../policy/auth/state-redaction.js';
import type {
    MutableClientState,
    PublicClientStateSnapshot,
} from './client-state-types.js';
import type { AvirxClientState } from '../../types.js';

export function freezeClientState(state: MutableClientState): AvirxClientState {
    const baseUrlHref = state.baseUrl.href;
    const snapshot: PublicClientStateSnapshot = { headers: state.headers };
    Object.defineProperty(snapshot, 'baseUrl', {
        enumerable: true,
        get() {
            return new URL(baseUrlHref);
        },
    });
    copyPublicClientState(snapshot, state);
    const frozen = Object.freeze(snapshot) as AvirxClientState;
    rememberRawAuthPolicy(frozen, state.auth);
    return frozen;
}

function copyPublicClientState(
    snapshot: PublicClientStateSnapshot,
    state: MutableClientState,
): void {
    if (state.auth) snapshot.auth = createPublicAuthState(state.auth);
    if (state.cache) snapshot.cache = state.cache;
    if (state.concurrency) snapshot.concurrency = state.concurrency;
    if (state.fetch) snapshot.fetch = state.fetch;
    if (state.hooks) snapshot.hooks = state.hooks;
    if (state.name) snapshot.name = state.name;
    if (state.rateLimit) snapshot.rateLimit = state.rateLimit;
    if (state.retry) snapshot.retry = state.retry;
    if (state.signal) snapshot.signal = state.signal;
    if (state.timeoutMs !== undefined) snapshot.timeoutMs = state.timeoutMs;
}
