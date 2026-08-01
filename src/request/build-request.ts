import { classifyBody } from '../transport/body.js';
import { appendQuery, normalizeQuery } from '../transport/query.js';
import { redactHeaders } from '../transport/redact.js';
import { interpolatePath, joinUrl } from '../transport/url.js';
import { freezeBuiltRequest } from './freeze-built-request.js';
import type { BuildRequestAuth, MutableBuiltRequest } from './built-request-types.js';
import type {
    AvirxBuiltRequest,
    AvirxClientState,
    AvirxQueryInput,
    AvirxRequestState,
} from '../types.js';

const EMPTY_BUILD_AUTH: BuildRequestAuth = Object.freeze({});

export function buildRequest(
    clientState: AvirxClientState,
    state: AvirxRequestState,
    auth: BuildRequestAuth = EMPTY_BUILD_AUTH,
): AvirxBuiltRequest {
    const path = interpolatePath(state.route, state.pathParams);
    const authQuery = auth.query ? normalizeQuery(auth.query) : {};
    const url = appendQuery(joinUrl(clientState.baseUrl, path), {
        ...authQuery,
        ...state.query,
    });
    const redactedUrl = hasQueryEntries(auth.redactedQuery)
        ? appendQuery(joinUrl(clientState.baseUrl, path), {
            ...normalizeQuery(auth.redactedQuery),
            ...state.query,
        })
        : url;
    const headers = Object.freeze({
        ...clientState.headers,
        ...auth.headers ?? {},
        ...state.headers,
    });
    const built: MutableBuiltRequest = {
        bodyMetadata: state.bodyMetadata ?? classifyBody(undefined),
        headers,
        method: state.method,
        redactedHeaders: Object.freeze({
            ...redactHeaders(headers),
            ...auth.redactedHeaders ?? {},
        }),
        redactedUrl,
        sensitiveHeaders: Object.freeze([...auth.sensitiveHeaders ?? []]),
        url,
    };
    if ('body' in state) built.body = state.body;
    const timeoutMs = state.timeoutMs === false ? undefined : state.timeoutMs ?? clientState.timeoutMs;
    if (timeoutMs !== undefined) built.timeoutMs = timeoutMs;
    const retry = state.retry ?? clientState.retry;
    if (retry) built.retry = retry;
    return freezeBuiltRequest(built);
}

function hasQueryEntries(query: AvirxQueryInput | undefined): query is AvirxQueryInput {
    if (query === undefined) return false;
    return query instanceof URLSearchParams
        ? !query.keys().next().done
        : Object.keys(query).length > 0;
}
