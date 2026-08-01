import {
    createPublicAuthState,
    rememberRawAuthPolicy,
} from '../../policy/auth/state-redaction.js';
import type {
    MutableRequestState,
    PublicRequestStateSnapshot,
} from './request-state-types.js';
import type { AvirxRequestState } from '../../types.js';

export function freezeRequestState(state: MutableRequestState): AvirxRequestState {
    const snapshot: PublicRequestStateSnapshot = {
        expectedStatuses: state.expectedStatuses,
        headers: state.headers,
        method: state.method,
        pathParams: state.pathParams,
        query: state.query,
        route: state.route,
    };
    copyPublicRequestState(snapshot, state);
    const frozen = Object.freeze(snapshot) as AvirxRequestState;
    rememberRawAuthPolicy(frozen, state.auth);
    return frozen;
}

function copyPublicRequestState(
    snapshot: PublicRequestStateSnapshot,
    state: MutableRequestState,
): void {
    if (state.auth) snapshot.auth = createPublicAuthState(state.auth);
    if ('body' in state) snapshot.body = state.body;
    if ('bodyMetadata' in state) snapshot.bodyMetadata = state.bodyMetadata;
    if (state.errorSchema) snapshot.errorSchema = state.errorSchema;
    if (state.hooks) snapshot.hooks = state.hooks;
    if (state.retry) snapshot.retry = state.retry;
    if (state.signal) snapshot.signal = state.signal;
    if (state.timeoutMs !== undefined) snapshot.timeoutMs = state.timeoutMs;
}
