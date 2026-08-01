import {
    avirx,
    type AvirxAuthBuilder,
    type AvirxAuthPolicy,
    type AvirxAuthState,
    type AvirxAuthTokenProvider,
    type AvirxCacheInput,
    type AvirxCacheMethod,
    type AvirxCachePolicy,
    type AvirxClient,
    type AvirxClientOptions,
    type AvirxClientState,
    type AvirxDurationInput,
    type AvirxHookContext,
    type AvirxHookEvent,
    type AvirxHookHandler,
    type AvirxHookRegistry,
    type AvirxRetryInput,
} from 'avirx';

const client: AvirxClient = avirx('https://api.example.com');
const clientOptions: AvirxClientOptions = { fetch };
const authToken: AvirxAuthTokenProvider = () => 'token';
const cacheInput: AvirxCacheInput = {
    maxBytes: 1024,
    methods: ['GET'],
    ttl: '30s',
    vary: ['accept'],
};
const namedClient: AvirxClient = client
    .name('example')
    .auth.bearer(authToken)
    .auth.basic('user', 'pass')
    .auth.apiKey('x-api-key', authToken)
    .auth.query('api_key', authToken)
    .timeout('5s')
    .cache(cacheInput);
const duration: AvirxDurationInput = '500ms';
const cacheMethod: AvirxCacheMethod = 'GET';
const retryInput: AvirxRetryInput = { attempts: 2, on: [503] };
const hookEvent: AvirxHookEvent = 'request';
const hookHandler: AvirxHookHandler = (context: AvirxHookContext) => {
    void context.request();
};
const authBuilder: AvirxAuthBuilder<AvirxClient> = client.auth;
const authPolicy: AvirxAuthPolicy = { kind: 'bearer', token: authToken };
const authState: AvirxAuthState = { kind: 'bearer', token: '[redacted]' };
const clientState: AvirxClientState = namedClient.state;
const cachePolicy: AvirxCachePolicy | undefined = clientState.cache;
const hooks: AvirxHookRegistry = {
    error: [],
    request: [hookHandler],
    response: [],
    retry: [],
};

void clientOptions;
void duration;
void cacheMethod;
void retryInput;
void hookEvent;
void authBuilder;
void authPolicy;
void authState;
void cachePolicy;
void hooks;
