import { buildRequest } from './built-request.js';
import { formatCurl } from './curl.js';
import {
    createApiKeyHeaderAuth,
    createApiKeyQueryAuth,
    createBasicAuth,
    createBearerAuth,
    resolveAuthHeaders,
} from './internals/auth.js';
import { prepareBodyState } from './internals/body-state.js';
import { normalizeDurationMs } from './internals/duration.js';
import { normalizeHeader, normalizeHeaders } from './internals/headers.js';
import { appendHook } from './internals/hooks.js';
import { normalizeQuery } from './internals/query.js';
import { createRequestState, forkRequestState } from './internals/request-state.js';
import { normalizeRetry } from './internals/retry.js';
import { normalizeExpectedStatuses } from './internals/status.js';
import { getRawAuthPolicy } from './internals/state-redaction.js';
import { executeDownload } from './download.js';
import { createMultipartBuilder } from './multipart.js';
import { executeAs, executeJson, executeResult, executeSend, executeText } from './terminals.js';
import type {
    AvirxBodyValue,
    AvirxAuthPolicy,
    AvirxAuthTokenProvider,
    AvirxClientState,
    AvirxCurlOptions,
    AvirxHeaders,
    AvirxHookEvent,
    AvirxHookHandler,
    AvirxInferSchema,
    AvirxPathParams,
    AvirxQueryInput,
    AvirxRequestBuilder,
    AvirxRequestState,
    AvirxRequestTimeoutInput,
    AvirxRetryInput,
    AvirxResult,
    AvirxSchema,
    HttpMethod,
} from './types.js';

type BodyAllowedForMethod<Method extends HttpMethod> = Method extends 'GET' | 'HEAD' ? false : true;

export function createRequestBuilder<Method extends HttpMethod, Route extends string>(
    clientState: AvirxClientState,
    method: Method,
    route: Route,
): AvirxRequestBuilder<Route, BodyAllowedForMethod<Method>> {
    return createRequestBuilderFromState<Route, BodyAllowedForMethod<Method>>(
        clientState,
        createRequestState(method, route),
    );
}

function createRequestBuilderFromState<
    Route extends string = string,
    CanHaveBody extends boolean = true,
    ErrorData = unknown,
>(
    clientState: AvirxClientState,
    state: AvirxRequestState,
): AvirxRequestBuilder<Route, CanHaveBody, ErrorData> {
    const builder = {
        async as<Schema extends AvirxSchema<unknown>>(
            schema: Schema,
        ): Promise<AvirxInferSchema<Schema>> {
            return executeAs(clientState, state, schema);
        },
        auth: Object.freeze({
            apiKey(name: string, key: AvirxAuthTokenProvider) {
                return createRequestBuilderFromState<Route, CanHaveBody, ErrorData>(
                    clientState,
                    forkRequestState(state, {
                        auth: createApiKeyHeaderAuth(name, key),
                    }),
                );
            },
            basic(username: string, password: string) {
                return createRequestBuilderFromState<Route, CanHaveBody, ErrorData>(
                    clientState,
                    forkRequestState(state, {
                        auth: createBasicAuth(username, password),
                    }),
                );
            },
            bearer(token: AvirxAuthTokenProvider) {
                return createRequestBuilderFromState<Route, CanHaveBody, ErrorData>(
                    clientState,
                    forkRequestState(state, {
                        auth: createBearerAuth(token),
                    }),
                );
            },
            query(name: string, key: AvirxAuthTokenProvider) {
                return createRequestBuilderFromState<Route, CanHaveBody, ErrorData>(
                    clientState,
                    forkRequestState(state, {
                        auth: createApiKeyQueryAuth(name, key),
                    }),
                );
            },
        }),
        async build() {
            return buildRequest(
                clientState,
                state,
                await resolveAuthHeaders(getEffectiveAuthPolicy(clientState, state)),
            );
        },
        body(body: AvirxBodyValue) {
            if (state.method === 'GET' || state.method === 'HEAD') {
                throw new TypeError(`${state.method} requests cannot have a body.`);
            }

            return createRequestBuilderFromState<Route, CanHaveBody, ErrorData>(
                clientState,
                forkRequestState(state, prepareBodyState(clientState.headers, state, body)),
            );
        },
        clientState,
        async curl(options?: AvirxCurlOptions) {
            return formatCurl(await this.build(), options);
        },
        async download() {
            return executeDownload(clientState, state);
        },
        error<Schema extends AvirxSchema<unknown>>(schema: Schema) {
            return createRequestBuilderFromState<
                Route,
                CanHaveBody,
                AvirxInferSchema<Schema>
            >(
                clientState,
                forkRequestState(state, {
                    errorSchema: schema,
                }),
            );
        },
        expect(statuses: number | readonly number[]) {
            return createRequestBuilderFromState<Route, CanHaveBody, ErrorData>(
                clientState,
                forkRequestState(state, {
                    expectedStatuses: normalizeExpectedStatuses(statuses),
                }),
            );
        },
        header(name: string, value: string) {
            return createRequestBuilderFromState<Route, CanHaveBody, ErrorData>(
                clientState,
                forkRequestState(state, {
                    headers: {
                        ...state.headers,
                        ...normalizeHeader(name, value),
                    },
                }),
            );
        },
        headers(headers: HeadersInit | AvirxHeaders) {
            return createRequestBuilderFromState<Route, CanHaveBody, ErrorData>(
                clientState,
                forkRequestState(state, {
                    headers: {
                        ...state.headers,
                        ...normalizeHeaders(headers),
                    },
                }),
            );
        },
        async json<T = unknown>() {
            return executeJson<T>(clientState, state);
        },
        on(event: AvirxHookEvent, handler: AvirxHookHandler) {
            return createRequestBuilderFromState<Route, CanHaveBody, ErrorData>(
                clientState,
                forkRequestState(state, {
                    hooks: appendHook(state.hooks, event, handler),
                }),
            );
        },
        multipart() {
            if (state.method === 'GET' || state.method === 'HEAD') {
                throw new TypeError(`${state.method} requests cannot have a multipart body.`);
            }

            return createMultipartBuilder<Route, ErrorData>(
                clientState,
                forkRequestState(state, prepareBodyState(clientState.headers, state, new FormData())),
                (nextClientState, nextState) => createRequestBuilderFromState<Route, true, ErrorData>(
                    nextClientState,
                    nextState,
                ),
            );
        },
        path(params: AvirxPathParams<Route>) {
            return createRequestBuilderFromState<Route, CanHaveBody, ErrorData>(
                clientState,
                forkRequestState(state, {
                    pathParams: params,
                }),
            );
        },
        async preview() {
            const built = await this.build();
            const preview: {
                body?: AvirxBodyValue;
                curl: string;
                headers: AvirxHeaders;
                method: HttpMethod;
                redactions: {
                    headers: AvirxHeaders;
                    url: string;
                };
                url: string;
            } = {
                curl: formatCurl(built),
                headers: built.redactedHeaders,
                method: built.method,
                redactions: {
                    headers: built.redactedHeaders,
                    url: built.redactedUrl.href,
                },
                url: built.redactedUrl.href,
            };

            if ('body' in built) {
                preview.body = built.body;
            }

            return Object.freeze(preview);
        },
        query(query: AvirxQueryInput) {
            return createRequestBuilderFromState<Route, CanHaveBody, ErrorData>(
                clientState,
                forkRequestState(state, {
                    query: {
                        ...state.query,
                        ...normalizeQuery(query),
                    },
                }),
            );
        },
        retry(input: AvirxRetryInput) {
            return createRequestBuilderFromState<Route, CanHaveBody, ErrorData>(
                clientState,
                forkRequestState(state, {
                    retry: normalizeRetry(input),
                }),
            );
        },
        async result(schema?: AvirxSchema<unknown>): Promise<AvirxResult<unknown, ErrorData>> {
            return executeResult<ErrorData>(clientState, state, schema);
        },
        async send() {
            return executeSend(clientState, state);
        },
        signal(signal: AbortSignal) {
            return createRequestBuilderFromState<Route, CanHaveBody, ErrorData>(
                clientState,
                forkRequestState(state, { signal }),
            );
        },
        state,
        async text() {
            return executeText(clientState, state);
        },
        timeout(duration: AvirxRequestTimeoutInput) {
            return createRequestBuilderFromState<Route, CanHaveBody, ErrorData>(
                clientState,
                forkRequestState(state, {
                    timeoutMs: duration === false ? false : normalizeDurationMs(duration),
                }),
            );
        },
    };

    return Object.freeze(builder) as unknown as AvirxRequestBuilder<Route, CanHaveBody, ErrorData>;
}

function getEffectiveAuthPolicy(
    clientState: AvirxClientState,
    state: AvirxRequestState,
): AvirxAuthPolicy | undefined {
    return getRawAuthPolicy(state) ?? getRawAuthPolicy(clientState);
}
