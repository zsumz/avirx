import { createReadonlySet, freezeRecord } from './freeze.js';
import { createPublicAuthState, getRawAuthPolicy, rememberRawAuthPolicy } from './state-redaction.js';
import type {
    AvirxAuthPolicy,
    AvirxBodyMetadata,
    AvirxBodyValue,
    AvirxHeaders,
    AvirxHookRegistry,
    AvirxPrimitiveValue,
    AvirxQueryValue,
    AvirxRequestState,
    AvirxRetryMetadata,
    AvirxSchema,
    HttpMethod,
} from '../types.js';

interface MutableRequestState {
    auth?: AvirxAuthPolicy;
    body?: AvirxBodyValue;
    bodyMetadata?: AvirxBodyMetadata;
    errorSchema?: AvirxSchema<unknown>;
    expectedStatuses: ReadonlySet<number>;
    headers: AvirxHeaders;
    hooks?: AvirxHookRegistry;
    method: HttpMethod;
    pathParams: Readonly<Record<string, AvirxPrimitiveValue>>;
    query: Readonly<Record<string, AvirxQueryValue>>;
    retry?: AvirxRetryMetadata;
    route: string;
    signal?: AbortSignal;
    timeoutMs?: false | number;
}

type PublicRequestStateSnapshot = {
    -readonly [Key in keyof AvirxRequestState]?: AvirxRequestState[Key];
};

export function createRequestState(method: HttpMethod, route: string): AvirxRequestState {
    return freezeRequestState({
        expectedStatuses: createReadonlySet<number>(),
        headers: Object.freeze({}),
        method,
        pathParams: Object.freeze({}),
        query: Object.freeze({}),
        route,
    });
}

export function forkRequestState(
    state: AvirxRequestState,
    patch: Partial<{
        body: AvirxBodyValue;
        bodyMetadata: AvirxBodyMetadata;
        auth: AvirxAuthPolicy;
        errorSchema: AvirxSchema<unknown>;
        expectedStatuses: Iterable<number>;
        headers: AvirxHeaders;
        hooks: AvirxHookRegistry;
        pathParams: Readonly<Record<string, AvirxPrimitiveValue>>;
        query: Readonly<Record<string, AvirxQueryValue>>;
        retry: AvirxRetryMetadata;
        signal: AbortSignal;
        timeoutMs: false | number;
    }>,
): AvirxRequestState {
    const next: MutableRequestState = {
        expectedStatuses: createReadonlySet(patch.expectedStatuses ?? state.expectedStatuses),
        headers: freezeRecord(patch.headers ?? state.headers),
        method: state.method,
        pathParams: freezeRecord(patch.pathParams ?? state.pathParams),
        query: freezeRecord(patch.query ?? state.query),
        route: state.route,
    };

    const auth = patch.auth ?? getRawAuthPolicy(state);
    if (auth) {
        next.auth = auth;
    }

    if ('body' in patch) {
        if (patch.body !== undefined) {
            next.body = patch.body;
        }
    } else if ('body' in state) {
        next.body = state.body;
    }

    if ('bodyMetadata' in patch) {
        next.bodyMetadata = patch.bodyMetadata;
    } else if (!('body' in patch) && 'bodyMetadata' in state) {
        next.bodyMetadata = state.bodyMetadata;
    }

    const hooks = patch.hooks ?? state.hooks;
    if (hooks) {
        next.hooks = hooks;
    }

    const errorSchema = patch.errorSchema ?? state.errorSchema;
    if (errorSchema) {
        next.errorSchema = errorSchema;
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

    return freezeRequestState(next);
}

function freezeRequestState(state: MutableRequestState): AvirxRequestState {
    const snapshot: PublicRequestStateSnapshot = {
        expectedStatuses: state.expectedStatuses,
        headers: state.headers,
        method: state.method,
        pathParams: state.pathParams,
        query: state.query,
        route: state.route,
    };

    if (state.auth) {
        snapshot.auth = createPublicAuthState(state.auth);
    }

    if ('body' in state) {
        snapshot.body = state.body;
    }

    if ('bodyMetadata' in state) {
        snapshot.bodyMetadata = state.bodyMetadata;
    }

    if (state.errorSchema) {
        snapshot.errorSchema = state.errorSchema;
    }

    if (state.hooks) {
        snapshot.hooks = state.hooks;
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

    const frozen = Object.freeze(snapshot) as AvirxRequestState;
    rememberRawAuthPolicy(frozen, state.auth);

    return frozen;
}
