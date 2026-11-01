import {
    avirx,
    endpoint,
    type AvirxBodyValue,
    type AvirxBuiltRequest,
    type AvirxCurlOptions,
    type AvirxDownload,
    type AvirxEndpointBuilder,
    type AvirxExpectedStatusInput,
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
    type AvirxResult,
} from 'avirx';

const client = avirx('https://api.example.com');
const curlOptions: AvirxCurlOptions = { redacted: false };
const requestTimeout: AvirxRequestTimeoutInput = false;
const expectedStatus: AvirxExpectedStatusInput = [200, 201];
type BookRoute = '/workspaces/{workspaceId}/books/{bookId}';
const pathParams: AvirxPathParams<BookRoute> = {
    bookId: 'book_123',
    workspaceId: 'wrk_123',
};
const pathName: AvirxPathParamNames<BookRoute> = 'workspaceId';
const requestBuilder: AvirxRequestBuilder<'/users/{id}', false> = client
    .get('/users/{id}')
    .path({ id: 'usr_123' })
    .expect(200)
    .query({ include: ['teams'] })
    .timeout(requestTimeout);
const builtRequest: Promise<AvirxBuiltRequest> = requestBuilder.build();
const curl: Promise<string> = requestBuilder.curl(curlOptions);
const preview: Promise<AvirxPreview> = requestBuilder.preview();
const download: Promise<AvirxDownload> = client.get('/exports/latest').download();
const bodyBuilder: AvirxRequestBuilder = client.post('/users').body({ email: 'a@example.com' });
const multipartBuilder: AvirxMultipartBuilder = client.post('/avatars').multipart();
const multipartField: AvirxMultipartFieldValue = 'usr_123';
const multipartFile: AvirxMultipartFileValue = new Blob(['avatar']);
multipartBuilder.field('userId', multipartField).file('avatar', multipartFile, 'avatar.txt');
const queryInput: AvirxQueryInput = { include: ['teams'], limit: 10 };
const queryValue: AvirxQueryValue = ['teams', 'roles'];
const bodyValue: AvirxBodyValue = { ok: true };
const requestState: AvirxRequestState = requestBuilder.state;
const unknownResult: Promise<AvirxResult<unknown>> = client.get('/users').result();
const builder: AvirxEndpointBuilder = endpoint;

client.get('/workspaces/{workspaceId}/books/{bookId}').path(pathParams);
// @ts-expect-error Missing bookId.
client.get('/workspaces/{workspaceId}/books/{bookId}').path({ workspaceId: 'wrk_123' });
// @ts-expect-error Extra path param.
client.get('/users/{id}').path({ extra: 'nope', id: 'usr_123' });
// @ts-expect-error Routes without placeholders do not expose .path().
void client.get('/users').path;
// @ts-expect-error GET builders do not expose request bodies.
void client.get('/users').body;

void expectedStatus;
void pathName;
void builtRequest;
void curl;
void preview;
void download;
void bodyBuilder;
void queryInput;
void queryValue;
void bodyValue;
void requestState;
void unknownResult;
void builder;
