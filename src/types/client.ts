import type { AvirxEndpointContract } from './endpoint.js';
import type {
    AvirxAuthBuilder,
    AvirxAuthState,
} from './auth.js';
import type {
    AvirxCacheInput,
    AvirxCachePolicy,
} from './cache.js';
import type {
    AvirxConcurrencyInput,
    AvirxConcurrencyLimiter,
} from './concurrency.js';
import type {
    AvirxHookEvent,
    AvirxHookHandler,
    AvirxHookRegistry,
} from './hooks.js';
import type {
    AvirxRateLimitInput,
    AvirxRateLimitLimiter,
} from './rate-limit.js';
import type {
    AvirxRetryInput,
    AvirxRetryMetadata,
} from './retry.js';
import type { AvirxContractClient } from './contract.js';
import type { AvirxDurationInput } from './duration.js';
import type { AvirxHeaders } from './http.js';
import type { AvirxRequestBuilder } from './request.js';

export type AvirxClient = Readonly<{
    auth: AvirxAuthBuilder<AvirxClient>;
    cache(input: AvirxCacheInput): AvirxClient;
    concurrency(input: AvirxConcurrencyInput): AvirxClient;
    contract<const Contract extends AvirxEndpointContract>(contract: Contract): AvirxContractClient<Contract>;
    delete<const Route extends string>(route: Route): AvirxRequestBuilder<Route, true>;
    get<const Route extends string>(route: Route): AvirxRequestBuilder<Route, false>;
    head<const Route extends string>(route: Route): AvirxRequestBuilder<Route, false>;
    header(name: string, value: string): AvirxClient;
    headers(headers: HeadersInit | AvirxHeaders): AvirxClient;
    name(name: string): AvirxClient;
    on(event: AvirxHookEvent, handler: AvirxHookHandler): AvirxClient;
    options<const Route extends string>(route: Route): AvirxRequestBuilder<Route, true>;
    patch<const Route extends string>(route: Route): AvirxRequestBuilder<Route, true>;
    post<const Route extends string>(route: Route): AvirxRequestBuilder<Route, true>;
    put<const Route extends string>(route: Route): AvirxRequestBuilder<Route, true>;
    rateLimit(input: AvirxRateLimitInput): AvirxClient;
    retry(input: AvirxRetryInput): AvirxClient;
    signal(signal: AbortSignal): AvirxClient;
    state: AvirxClientState;
    timeout(duration: AvirxDurationInput): AvirxClient;
}>;

export type AvirxClientOptions = Readonly<{
    allowCredentialRedirects?: boolean;
    fetch?: typeof fetch;
}>;

export type AvirxClientState = Readonly<{
    allowCredentialRedirects?: boolean;
    auth?: AvirxAuthState;
    baseUrl: URL;
    cache?: AvirxCachePolicy;
    concurrency?: AvirxConcurrencyLimiter;
    fetch?: typeof fetch;
    headers: AvirxHeaders;
    hooks?: AvirxHookRegistry;
    name?: string;
    rateLimit?: AvirxRateLimitLimiter;
    retry?: AvirxRetryMetadata;
    signal?: AbortSignal;
    timeoutMs?: number;
}>;
