import {
    AvirxError,
    formatCurl,
    isAvirxError,
    parseWithSchema,
    type AvirxBuiltRequest,
    type AvirxHeaders,
    type AvirxInferSchema,
    type AvirxResponse,
    type AvirxResult,
    type AvirxRetryEvent,
    type AvirxRetryMetadata,
    type AvirxSchema,
    type AvirxTimingMetadata,
    type HttpMethod,
} from 'avirx';

const method: HttpMethod = 'GET';
const schema: AvirxSchema<string> = { parse: String };
type SchemaOutput = AvirxInferSchema<typeof schema>;
const parsedSchema: SchemaOutput = parseWithSchema(schema, 123);
const headers: AvirxHeaders = { accept: 'application/json' };
const timing: AvirxTimingMetadata = { durationMs: 10 };
const retry: AvirxRetryMetadata = { attempts: 2, on: [503], safeOnly: true };
const retryEvent: AvirxRetryEvent = { attempt: 1, delayMs: 10, status: 503 };
const request: AvirxBuiltRequest = {
    authenticated: false,
    bodyMetadata: { kind: 'none' },
    headers,
    method,
    redactedHeaders: headers,
    redactedUrl: new URL('https://api.example.com/users'),
    retry,
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
    url: request.url.href,
};
const result: AvirxResult<string> = { data: 'ok', ok: true, response, status: 200 };
const formattedCurl: string = formatCurl(request);
const error = new AvirxError('boom', { request });

isAvirxError(error);
void parsedSchema;
void retryEvent;
void result;
void formattedCurl;
