import {
    AvirxError,
    avirx,
    endpoint,
    formatCurl,
    isAvirxError,
    parseWithSchema,
    type AvirxAuthBuilder,
    type AvirxAuthPolicy,
    type AvirxAuthState,
    type AvirxAuthTokenProvider,
    type AvirxBodyValue,
    type AvirxBuiltRequest,
    type AvirxCacheInput,
    type AvirxCacheMethod,
    type AvirxCachePolicy,
    type AvirxClient,
    type AvirxClientOptions,
    type AvirxClientState,
    type AvirxCurlOptions,
    type AvirxDurationInput,
    type AvirxDownload,
    type AvirxEndpointBuilder,
    type AvirxExpectedStatusInput,
    type AvirxHeaders,
    type AvirxHookContext,
    type AvirxHookEvent,
    type AvirxHookHandler,
    type AvirxHookRegistry,
    type AvirxInferSchema,
    type AvirxMultipartBuilder,
    type AvirxMultipartFieldValue,
    type AvirxMultipartFileValue,
    type AvirxPathParamNames,
    type AvirxPathParams,
    type AvirxPreview,
    type AvirxQueryInput,
    type AvirxQueryValue,
    type AvirxRequestBuilder,
    type AvirxRequestState,
    type AvirxRequestTimeoutInput,
    type AvirxResponse,
    type AvirxRetryEvent,
    type AvirxRetryInput,
    type AvirxRetryMetadata,
    type AvirxResult,
    type AvirxSchema,
    type AvirxTimingMetadata,
    type HttpMethod,
} from 'avirx';

const client: AvirxClient = avirx('https://api.example.com');
const clientOptions: AvirxClientOptions = { fetch };
const curlOptions: AvirxCurlOptions = { redacted: false };
const authToken: AvirxAuthTokenProvider = () => 'token';
const cacheInput: AvirxCacheInput = { maxBytes: 1024, methods: ['GET'], ttl: '30s', vary: ['accept'] };
const abortSignal = new AbortController().signal;
const namedClient: AvirxClient = client
    .name('example')
    .auth.bearer(authToken)
    .auth.basic('user', 'pass')
    .auth.apiKey('x-api-key', authToken)
    .auth.query('api_key', authToken)
    .timeout('5s')
    .signal(abortSignal)
    .cache(cacheInput)
    .header('x-trace', 'trace_123')
    .headers({ 'x-client': 'avirx' });
const timeout: AvirxDurationInput = '500ms';
const requestTimeout: AvirxRequestTimeoutInput = false;
const cacheMethod: AvirxCacheMethod = 'GET';
const retryInput: AvirxRetryInput = { attempts: 2, on: [503] };
const hookEvent: AvirxHookEvent = 'request';
const hookHandler: AvirxHookHandler = (context: AvirxHookContext) => {
    void context.request();
};
const expectedStatus: AvirxExpectedStatusInput = [200, 201];
type BookRoute = '/workspaces/{workspaceId}/books/{bookId}';
const pathParams: AvirxPathParams<BookRoute> = {
    bookId: 'book_123',
    workspaceId: 'wrk_123',
};
const pathName: AvirxPathParamNames<BookRoute> = 'workspaceId';
const requestBuilder: AvirxRequestBuilder<'/users/{id}', false> = namedClient
    .get('/users/{id}')
    .auth.bearer(async () => Promise.resolve('request-token'))
    .auth.basic('request-user', 'request-pass')
    .auth.apiKey('x-request-key', authToken)
    .auth.query('request_key', authToken)
    .on(hookEvent, hookHandler)
    .path({ id: 'usr_123' })
    .expect(200)
    .header('accept', 'application/json')
    .headers({ 'x-request': 'req_123' })
    .query({ include: ['teams', 'roles'] })
    .retry(retryInput)
    .signal(abortSignal)
    .timeout(requestTimeout);
const builtRequestPromise: Promise<AvirxBuiltRequest> = requestBuilder.build();
const curlPromise: Promise<string> = requestBuilder.curl(curlOptions);
const previewPromise: Promise<AvirxPreview> = requestBuilder.preview();
const downloadPromise: Promise<AvirxDownload> = namedClient.get('/exports/latest').download();
const bodyBuilder: AvirxRequestBuilder = namedClient.post('/users').body({ email: 'a@example.com' });
const multipartBuilder: AvirxMultipartBuilder = namedClient.post('/avatars').multipart();
const multipartField: AvirxMultipartFieldValue = 'usr_123';
const multipartFile: AvirxMultipartFileValue = new Blob(['avatar']);
multipartBuilder.field('userId', multipartField).file('avatar', multipartFile, 'avatar.txt');
const parsedJson: Promise<{ id: string }> = namedClient.get('/users/{id}').path({ id: 'usr_123' }).json<{
    id: string;
}>();
const parsedText: Promise<string> = namedClient.get('/users/{id}').path({ id: 'usr_123' }).text();
const userSchema = {
    parse(input: unknown): { id: string } {
        return input as { id: string };
    },
};
const errorSchema = {
    parse(input: unknown): { code: string } {
        return input as { code: string };
    },
};
const parsedUser: Promise<{ id: string }> = namedClient.get('/users/{id}').path({ id: 'usr_123' }).as(userSchema);
const requestWithErrorSchema: AvirxRequestBuilder<'/users', false, { code: string }> = namedClient
    .get('/users')
    .error(errorSchema);
const parsedUserResult: Promise<AvirxResult<{ id: string }, { code: string }>> = namedClient
    .get('/users/{id}')
    .path({ id: 'usr_123' })
    .error(errorSchema)
    .result(userSchema);
const unknownResult: Promise<AvirxResult<unknown>> = namedClient.get('/users').result();
namedClient.get('/workspaces/{workspaceId}/books/{bookId}').path(pathParams);
// @ts-expect-error Missing bookId.
namedClient.get('/workspaces/{workspaceId}/books/{bookId}').path({ workspaceId: 'wrk_123' });
// @ts-expect-error Extra path param.
namedClient.get('/users/{id}').path({ extra: 'nope', id: 'usr_123' });
// @ts-expect-error Routes without placeholders do not expose .path().
namedClient.get('/users').path({});
// @ts-expect-error GET builders do not expose request bodies.
namedClient.get('/users').body({ ok: true });
// @ts-expect-error GET builders do not expose multipart bodies.
namedClient.get('/users').multipart();
const builder: AvirxEndpointBuilder = endpoint;
const method: HttpMethod = 'GET';
const schema: AvirxSchema<string> = { parse: String };
type SchemaOutput = AvirxInferSchema<typeof schema>;
const parsedSchema: SchemaOutput = parseWithSchema(schema, 123);
const authBuilder: AvirxAuthBuilder<AvirxClient> = client.auth;
const authPolicy: AvirxAuthPolicy = {
    kind: 'bearer',
    token: authToken,
};
const authState: AvirxAuthState = {
    kind: 'bearer',
    token: '[redacted]',
};
const headers: AvirxHeaders = { accept: 'application/json' };
const queryInput: AvirxQueryInput = { include: ['teams', 'roles'], limit: 10 };
const query: AvirxQueryValue = ['teams', 'roles'];
const body: AvirxBodyValue = { ok: true };
const timing: AvirxTimingMetadata = { durationMs: 10 };
const retryMetadata: AvirxRetryMetadata = { attempts: 2, on: [503], safeOnly: true };
const retryEvent: AvirxRetryEvent = { attempt: 1, delayMs: 10, status: 503 };
const clientState: AvirxClientState = namedClient.state;
const requestState: AvirxRequestState = namedClient.get('/users/{id}').state;
const cachePolicy: AvirxCachePolicy | undefined = clientState.cache;
const hooks: AvirxHookRegistry = {
    error: [],
    request: [hookHandler],
    response: [],
    retry: [],
};
const request: AvirxBuiltRequest = {
    body,
    bodyMetadata: { kind: 'json' },
    headers,
    method,
    redactedHeaders: headers,
    redactedUrl: new URL('https://api.example.com/users'),
    retry: retryMetadata,
    sensitiveHeaders: [],
    url: new URL('https://api.example.com/users'),
};
const response: AvirxResponse<string> = {
    data: 'ok',
    headers,
    native: new Response('ok'),
    ok: true,
    request,
    status: 200,
    statusText: 'OK',
    timing,
    url: 'https://api.example.com/users',
};
const download: AvirxDownload = {
    blob: new Blob(['ok']),
    filename: 'ok.txt',
    response,
    status: 200,
};
const formattedCurl: string = formatCurl(request);
const preview: AvirxPreview = {
    curl: formattedCurl,
    headers,
    method,
    redactions: {
        headers,
        url: 'https://api.example.com/users',
    },
    url: 'https://api.example.com/users',
};
const result: AvirxResult<string> = { ok: true, status: 200, data: 'ok', response };
const error = new AvirxError('boom', { request });

isAvirxError(error);

void client;
void clientOptions;
void curlOptions;
void authToken;
void authState;
void cacheInput;
void abortSignal;
void namedClient;
void timeout;
void requestTimeout;
void cacheMethod;
void retryInput;
void hookEvent;
void hookHandler;
void expectedStatus;
void pathName;
void pathParams;
void requestBuilder;
void builtRequestPromise;
void curlPromise;
void previewPromise;
void downloadPromise;
void bodyBuilder;
void multipartBuilder;
void multipartField;
void multipartFile;
void parsedJson;
void parsedText;
void parsedUser;
void requestWithErrorSchema;
void parsedUserResult;
void unknownResult;
void builder;
void method;
void schema;
void authBuilder;
void authPolicy;
void parsedSchema;
void queryInput;
void query;
void request;
void response;
void download;
void retryEvent;
void retryMetadata;
void cachePolicy;
void requestState;
void hooks;
void preview;
void result;
void formattedCurl;
