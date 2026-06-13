import { classifyBody } from './internals/body.js';
import { appendQuery, normalizeQuery } from './internals/query.js';
import { redactHeaders } from './internals/redact.js';
import { interpolatePath, joinUrl } from './internals/url.js';
import type {
    AvirxBodyValue,
    AvirxBuiltRequest,
    AvirxClientState,
    AvirxHeaders,
    AvirxQueryInput,
    AvirxRequestState,
} from './types.js';

type BuildRequestAuth = Readonly<{
    headers?: AvirxHeaders;
    query?: AvirxQueryInput;
    redactedHeaders?: AvirxHeaders;
    redactedQuery?: AvirxQueryInput;
    sensitiveHeaders?: readonly string[];
}>;

interface MutableBuiltRequest {
    body?: AvirxBodyValue;
    bodyMetadata: AvirxBuiltRequest['bodyMetadata'];
    headers: AvirxHeaders;
    method: AvirxBuiltRequest['method'];
    redactedHeaders: AvirxHeaders;
    redactedUrl: URL;
    retry?: NonNullable<AvirxBuiltRequest['retry']>;
    sensitiveHeaders: readonly string[];
    timeoutMs?: number;
    url: URL;
}

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
    const bodyMetadata = state.bodyMetadata ?? classifyBody(undefined);

    const built: MutableBuiltRequest = {
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

    if ('body' in state) {
        built.body = state.body;
    }

    const timeoutMs = state.timeoutMs === false ? undefined : state.timeoutMs ?? clientState.timeoutMs;
    if (timeoutMs !== undefined) {
        built.timeoutMs = timeoutMs;
    }

    const retry = state.retry ?? clientState.retry;
    if (retry) {
        built.retry = retry;
    }

    return freezeBuiltRequest(built);
}

function hasQueryEntries(query: AvirxQueryInput | undefined): query is AvirxQueryInput {
    if (query === undefined) {
        return false;
    }

    if (query instanceof URLSearchParams) {
        return !query.keys().next().done;
    }

    return Object.keys(query).length > 0;
}

export function toFetchBody(body: AvirxBodyValue): BodyInit | null | undefined {
    if (body === undefined || body === null) {
        return undefined;
    }

    if (
        typeof body === 'string' ||
    body instanceof ArrayBuffer ||
    body instanceof Blob ||
    body instanceof FormData ||
    body instanceof ReadableStream ||
    body instanceof URLSearchParams
    ) {
        return body;
    }

    return JSON.stringify(body);
}

function freezeBuiltRequest(request: MutableBuiltRequest): AvirxBuiltRequest {
    const urlHref = request.url.href;
    const redactedUrlHref = request.redactedUrl.href;
    const snapshot: Partial<MutableBuiltRequest> = {
        bodyMetadata: request.bodyMetadata,
        headers: request.headers,
        method: request.method,
        redactedHeaders: request.redactedHeaders,
        sensitiveHeaders: request.sensitiveHeaders,
    };

    Object.defineProperties(snapshot, {
        redactedUrl: {
            enumerable: true,
            get() {
                return new URL(redactedUrlHref);
            },
        },
        url: {
            enumerable: true,
            get() {
                return new URL(urlHref);
            },
        },
    });

    if ('body' in request) {
        snapshot.body = request.body;
    }

    if (request.retry) {
        snapshot.retry = request.retry;
    }

    if (request.timeoutMs !== undefined) {
        snapshot.timeoutMs = request.timeoutMs;
    }

    return Object.freeze(snapshot) as AvirxBuiltRequest;
}
