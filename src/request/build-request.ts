import { classifyBody } from '../transport/body.js';
import { appendQuery, normalizeQuery } from '../transport/query.js';
import { redactHeaders } from '../transport/redact.js';
import { interpolatePath, joinUrl } from '../transport/url.js';
import { freezeBuiltRequest } from './freeze-built-request.js';
import { getEffectiveAuthPolicy } from './effective-auth.js';
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
    const redactedUrl = redactAuthQuery(url, auth.redactedQuery);
    const bodyMetadata = state.bodyMetadata ?? classifyBody(undefined);
    const explicitHeaders = {
        ...clientState.headers,
        ...auth.headers ?? {},
        ...state.headers,
    };
    const headers = Object.freeze({
        ...bodyMetadata.kind === 'json' && explicitHeaders['content-type'] === undefined
            ? { 'content-type': 'application/json' } : {},
        ...explicitHeaders,
    });
    const built: MutableBuiltRequest = {
        authenticated: getEffectiveAuthPolicy(clientState, state) !== undefined,
        bodyMetadata,
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

function redactAuthQuery(url: URL, redactedQuery: AvirxQueryInput | undefined): URL {
    const redacted = new URL(url.href);
    if (redactedQuery !== undefined) {
        for (const [name, value] of Object.entries(normalizeQuery(redactedQuery))) {
            redacted.searchParams.set(name, String(value));
        }
    }
    return redacted;
}
