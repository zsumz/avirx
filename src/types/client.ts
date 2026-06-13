import type { AvirxEndpointContract } from './endpoint.js';
import type {
    AvirxAuthBuilder,
    AvirxAuthState,
    AvirxCacheInput,
    AvirxCachePolicy,
    AvirxConcurrencyInput,
    AvirxConcurrencyLimiter,
    AvirxHookEvent,
    AvirxHookHandler,
    AvirxHookRegistry,
    AvirxRateLimitInput,
    AvirxRateLimitLimiter,
    AvirxRetryInput,
    AvirxRetryMetadata,
} from './policy.js';
import type { AvirxContractClient } from './contract.js';
import type { AvirxDurationInput, AvirxHeaders } from './common.js';
import type { AvirxRequestBuilder } from './request.js';

export type AvirxClient = Readonly<{
    auth: AvirxAuthBuilder<AvirxClient>;
    cache(input: AvirxCacheInput): AvirxClient;
    concurrency(input: AvirxConcurrencyInput): AvirxClient;
    contract<const Contract extends AvirxEndpointContract>(contract: Contract): AvirxContractClient<Contract>;
    delete<const Route extends string>(route: Route): AvirxRequestBuilder<Route>;
    get<const Route extends string>(route: Route): AvirxRequestBuilder<Route, false>;
    head<const Route extends string>(route: Route): AvirxRequestBuilder<Route, false>;
    header(name: string, value: string): AvirxClient;
    headers(headers: HeadersInit | AvirxHeaders): AvirxClient;
    name(name: string): AvirxClient;
    on(event: AvirxHookEvent, handler: AvirxHookHandler): AvirxClient;
    options<const Route extends string>(route: Route): AvirxRequestBuilder<Route>;
    patch<const Route extends string>(route: Route): AvirxRequestBuilder<Route>;
    post<const Route extends string>(route: Route): AvirxRequestBuilder<Route>;
    put<const Route extends string>(route: Route): AvirxRequestBuilder<Route>;
    rateLimit(input: AvirxRateLimitInput): AvirxClient;
    retry(input: AvirxRetryInput): AvirxClient;
    signal(signal: AbortSignal): AvirxClient;
    state: AvirxClientState;
    timeout(duration: AvirxDurationInput): AvirxClient;
}>;

export type AvirxClientOptions = Readonly<{
    fetch?: typeof fetch;
}>;

export type AvirxClientState = Readonly<{
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
