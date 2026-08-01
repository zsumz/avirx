import type { AvirxBodyMetadata, AvirxBodyValue, AvirxMultipartFieldValue, AvirxMultipartFileValue } from './body.js';
import type { AvirxClientState } from './client.js';
import type { AvirxCurlOptions } from './curl.js';
import type { AvirxDurationInput } from './duration.js';
import type { AvirxExpectedStatusInput, AvirxHeaders, HttpMethod } from './http.js';
import type { AvirxPrimitiveValue } from './primitive.js';
import type { AvirxAuthBuilder, AvirxAuthState } from './auth.js';
import type {
    AvirxHookEvent,
    AvirxHookHandler,
    AvirxHookRegistry,
} from './hooks.js';
import type { AvirxRetryInput, AvirxRetryMetadata } from './retry.js';
import type { AvirxDownload, AvirxResponse, AvirxResult } from './response.js';
import type { AvirxInferSchema, AvirxSchema } from './schema.js';

export type AvirxRequestTimeoutInput = AvirxDurationInput | false;

export type AvirxPathParamNames<Route extends string> =
    Route extends `${string}{${infer Param}}${infer Rest}`
        ? Param | AvirxPathParamNames<Rest>
        : never;

export type AvirxPathParams<Route extends string> =
    [AvirxPathParamNames<Route>] extends [never]
        ? Readonly<Record<string, never>>
        : Readonly<Record<AvirxPathParamNames<Route>, AvirxPrimitiveValue>>;

type AvirxExactPathParams<
    Route extends string,
    Params extends Readonly<Record<string, unknown>>,
> = Params & Readonly<Record<Exclude<keyof Params, AvirxPathParamNames<Route>>, never>>;

export type AvirxQueryValue =
  | AvirxPrimitiveValue
  | readonly AvirxPrimitiveValue[]
  | null
  | undefined;

export type AvirxQueryInput = URLSearchParams | Readonly<Record<string, AvirxQueryValue>>;

export type AvirxBuiltRequest = Readonly<{
    body?: AvirxBodyValue;
    bodyMetadata: AvirxBodyMetadata;
    headers: AvirxHeaders;
    method: HttpMethod;
    redactedUrl: URL;
    redactedHeaders: AvirxHeaders;
    retry?: AvirxRetryMetadata;
    sensitiveHeaders: readonly string[];
    timeoutMs?: number;
    url: URL;
}>;

export type AvirxPreview = Readonly<{
    body?: AvirxBodyValue;
    curl: string;
    headers: AvirxHeaders;
    method: HttpMethod;
    redactions: Readonly<{
        headers: AvirxHeaders;
        url: string;
    }>;
    url: string;
}>;

export type AvirxRequestBuilder<
    Route extends string = string,
    CanHaveBody extends boolean = true,
    ErrorData = unknown,
> = Readonly<{
    as<Schema extends AvirxSchema<unknown>>(schema: Schema): Promise<AvirxInferSchema<Schema>>;
    auth: AvirxAuthBuilder<AvirxRequestBuilder<Route, CanHaveBody, ErrorData>>;
    build(): Promise<AvirxBuiltRequest>;
    clientState: AvirxClientState;
    curl(options?: AvirxCurlOptions): Promise<string>;
    download(): Promise<AvirxDownload>;
    error<Schema extends AvirxSchema<unknown>>(
        schema: Schema,
    ): AvirxRequestBuilder<Route, CanHaveBody, AvirxInferSchema<Schema>>;
    expect(statuses: AvirxExpectedStatusInput): AvirxRequestBuilder<Route, CanHaveBody, ErrorData>;
    header(name: string, value: string): AvirxRequestBuilder<Route, CanHaveBody, ErrorData>;
    headers(headers: HeadersInit | AvirxHeaders): AvirxRequestBuilder<Route, CanHaveBody, ErrorData>;
    json<T = unknown>(): Promise<T>;
    on(event: AvirxHookEvent, handler: AvirxHookHandler): AvirxRequestBuilder<Route, CanHaveBody, ErrorData>;
    preview(): Promise<AvirxPreview>;
    query(query: AvirxQueryInput): AvirxRequestBuilder<Route, CanHaveBody, ErrorData>;
    retry(input: AvirxRetryInput): AvirxRequestBuilder<Route, CanHaveBody, ErrorData>;
    result(): Promise<AvirxResult<unknown, ErrorData>>;
    result<Schema extends AvirxSchema<unknown>>(
        schema: Schema,
    ): Promise<AvirxResult<AvirxInferSchema<Schema>, ErrorData>>;
    send(): Promise<AvirxResponse>;
    signal(signal: AbortSignal): AvirxRequestBuilder<Route, CanHaveBody, ErrorData>;
    state: AvirxRequestState;
    text(): Promise<string>;
    timeout(duration: AvirxRequestTimeoutInput): AvirxRequestBuilder<Route, CanHaveBody, ErrorData>;
}> &
  ([AvirxPathParamNames<Route>] extends [never]
      ? Readonly<Record<string, never>>
      : Readonly<{
          path<const Params extends AvirxPathParams<Route>>(
              params: AvirxExactPathParams<Route, Params>,
          ): AvirxRequestBuilder<Route, CanHaveBody, ErrorData>;
      }>) &
  (CanHaveBody extends true
      ? Readonly<{
          body(body: AvirxBodyValue): AvirxRequestBuilder<Route, CanHaveBody, ErrorData>;
          multipart(): AvirxMultipartBuilder<Route, ErrorData>;
      }>
      : Readonly<Record<string, never>>);

export type AvirxMultipartBuilder<
    Route extends string = string,
    ErrorData = unknown,
> = AvirxRequestBuilder<Route, true, ErrorData> & Readonly<{
    field(name: string, value: AvirxMultipartFieldValue): AvirxMultipartBuilder<Route, ErrorData>;
    file(name: string, value: AvirxMultipartFileValue, filename?: string): AvirxMultipartBuilder<Route, ErrorData>;
}>;

export type AvirxRequestState = Readonly<{
    auth?: AvirxAuthState;
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
}>;
