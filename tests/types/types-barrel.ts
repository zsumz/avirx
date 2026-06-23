import type {
    AvirxAnyEndpointDefinition,
    AvirxAuthBuilder,
    AvirxAuthPolicy,
    AvirxAuthState,
    AvirxAuthTokenProvider,
    AvirxBodyMetadata,
    AvirxBodyValue,
    AvirxBuiltRequest,
    AvirxCacheInput,
    AvirxCacheMethod,
    AvirxCachePolicy,
    AvirxClient,
    AvirxClientOptions,
    AvirxClientState,
    AvirxConcurrencyInput,
    AvirxConcurrencyLimiter,
    AvirxContractCall,
    AvirxContractClient,
    AvirxContractInput,
    AvirxContractOutput,
    AvirxCurlOptions,
    AvirxDownload,
    AvirxDurationInput,
    AvirxEndpointBuilder,
    AvirxEndpointContract,
    AvirxEndpointDefinition,
    AvirxEndpointState,
    AvirxExpectedStatusInput,
    AvirxHeaders,
    AvirxHookContext,
    AvirxHookEvent,
    AvirxHookHandler,
    AvirxHookRegistry,
    AvirxInferSchema,
    AvirxMultipartBuilder,
    AvirxMultipartFieldValue,
    AvirxMultipartFileValue,
    AvirxPathParamNames,
    AvirxPathParams,
    AvirxPreview,
    AvirxPrimitiveValue,
    AvirxQueryInput,
    AvirxQueryValue,
    AvirxRateLimitInput,
    AvirxRateLimitLimiter,
    AvirxRequestBuilder,
    AvirxRequestState,
    AvirxRequestTimeoutInput,
    AvirxResponse,
    AvirxResult,
    AvirxRetryEvent,
    AvirxRetryInput,
    AvirxRetryMetadata,
    AvirxSchema,
    AvirxTimingMetadata,
    HttpMethod,
} from '../../src/types.js';

type FixtureSchema = AvirxSchema<{ id: string }>;

export type SourceTypesBarrelFixture = Readonly<{
    anyEndpointDefinition: AvirxAnyEndpointDefinition;
    authBuilder: AvirxAuthBuilder<AvirxClient>;
    authPolicy: AvirxAuthPolicy;
    authState: AvirxAuthState;
    authTokenProvider: AvirxAuthTokenProvider;
    bodyMetadata: AvirxBodyMetadata;
    bodyValue: AvirxBodyValue;
    builtRequest: AvirxBuiltRequest;
    cacheInput: AvirxCacheInput;
    cacheMethod: AvirxCacheMethod;
    cachePolicy: AvirxCachePolicy;
    client: AvirxClient;
    clientOptions: AvirxClientOptions;
    clientState: AvirxClientState;
    concurrencyInput: AvirxConcurrencyInput;
    concurrencyLimiter: AvirxConcurrencyLimiter;
    contractCall: AvirxContractCall<AvirxAnyEndpointDefinition>;
    contractClient: AvirxContractClient<AvirxEndpointContract>;
    contractInput: AvirxContractInput<AvirxAnyEndpointDefinition>;
    contractOutput: AvirxContractOutput<AvirxAnyEndpointDefinition>;
    curlOptions: AvirxCurlOptions;
    download: AvirxDownload;
    durationInput: AvirxDurationInput;
    endpointBuilder: AvirxEndpointBuilder;
    endpointContract: AvirxEndpointContract;
    endpointDefinition: AvirxEndpointDefinition;
    endpointState: AvirxEndpointState;
    expectedStatusInput: AvirxExpectedStatusInput;
    headers: AvirxHeaders;
    hookContext: AvirxHookContext;
    hookEvent: AvirxHookEvent;
    hookHandler: AvirxHookHandler;
    hookRegistry: AvirxHookRegistry;
    inferredSchema: AvirxInferSchema<FixtureSchema>;
    method: HttpMethod;
    multipartBuilder: AvirxMultipartBuilder;
    multipartFieldValue: AvirxMultipartFieldValue;
    multipartFileValue: AvirxMultipartFileValue;
    pathParamName: AvirxPathParamNames<'/users/{id}'>;
    pathParams: AvirxPathParams<'/users/{id}'>;
    preview: AvirxPreview;
    primitiveValue: AvirxPrimitiveValue;
    queryInput: AvirxQueryInput;
    queryValue: AvirxQueryValue;
    rateLimitInput: AvirxRateLimitInput;
    rateLimitLimiter: AvirxRateLimitLimiter;
    requestBuilder: AvirxRequestBuilder;
    requestState: AvirxRequestState;
    requestTimeoutInput: AvirxRequestTimeoutInput;
    response: AvirxResponse;
    result: AvirxResult<unknown>;
    retryEvent: AvirxRetryEvent;
    retryInput: AvirxRetryInput;
    retryMetadata: AvirxRetryMetadata;
    schema: FixtureSchema;
    timingMetadata: AvirxTimingMetadata;
}>;
