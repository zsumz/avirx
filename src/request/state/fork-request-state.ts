import { getRawAuthPolicy } from '../../policy/auth/state-redaction.js';
import { createReadonlySet, freezeRecord } from '../../state/freeze.js';
import { normalizeQuery } from '../../transport/query.js';
import { freezeRequestState } from './freeze-request-state.js';
import type {
    MutableRequestState,
    RequestStatePatch,
} from './request-state-types.js';
import type { AvirxRequestState } from '../../types.js';

export function forkRequestState(
    state: AvirxRequestState,
    patch: RequestStatePatch,
): AvirxRequestState {
    const next: MutableRequestState = {
        expectedStatuses: createReadonlySet(patch.expectedStatuses ?? state.expectedStatuses),
        headers: freezeRecord(patch.headers ?? state.headers),
        method: state.method,
        pathParams: freezeRecord(patch.pathParams ?? state.pathParams),
        query: normalizeQuery(patch.query ?? state.query),
        route: state.route,
    };
    const auth = patch.auth ?? getRawAuthPolicy(state);
    if (auth) next.auth = auth;
    copyRequestBody(next, state, patch);
    copyOptionalRequestState(next, state, patch);
    return freezeRequestState(next);
}

function copyRequestBody(
    next: MutableRequestState,
    state: AvirxRequestState,
    patch: RequestStatePatch,
): void {
    if ('body' in patch) {
        if (patch.body !== undefined) next.body = patch.body;
    } else if ('body' in state) {
        next.body = state.body;
    }
    if ('bodyMetadata' in patch) {
        next.bodyMetadata = patch.bodyMetadata;
    } else if (!('body' in patch) && 'bodyMetadata' in state) {
        next.bodyMetadata = state.bodyMetadata;
    }
}

function copyOptionalRequestState(
    next: MutableRequestState,
    state: AvirxRequestState,
    patch: RequestStatePatch,
): void {
    const hooks = patch.hooks ?? state.hooks;
    if (hooks) next.hooks = hooks;
    const errorSchema = patch.errorSchema ?? state.errorSchema;
    if (errorSchema) next.errorSchema = errorSchema;
    const retry = patch.retry ?? state.retry;
    if (retry) next.retry = retry;
    const signal = patch.signal ?? state.signal;
    if (signal) next.signal = signal;
    const timeoutMs = patch.timeoutMs ?? state.timeoutMs;
    if (timeoutMs !== undefined) next.timeoutMs = timeoutMs;
}
