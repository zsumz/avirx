import type { AvirxError } from '../errors.js';
import type { AvirxBuiltRequest } from './request.js';
import type { AvirxResponse } from './response.js';
import type { AvirxDurationInput } from './common.js';

export type AvirxConcurrencyInput = number;

export type AvirxConcurrencyLimiter = Readonly<{
    acquire(signal?: AbortSignal): Promise<() => void>;
    active(): number;
    max: number;
    queued(): number;
}>;

export type AvirxRateLimitInput = Readonly<{
    per: AvirxDurationInput;
    queue?: number;
    queueTimeout?: AvirxDurationInput;
    requests: number;
}>;

export type AvirxRateLimitLimiter = Readonly<{
    acquire(request: AvirxBuiltRequest, signal?: AbortSignal): Promise<void>;
    perMs: number;
    queued(): number;
    requests: number;
    starts(): number;
}>;

export type AvirxCacheMethod = 'GET' | 'HEAD';

export type AvirxCacheInput = Readonly<{
    maxBytes?: number;
    methods?: readonly AvirxCacheMethod[];
    ttl: AvirxDurationInput;
    vary?: readonly string[];
}>;

export type AvirxCachePolicy = Readonly<{
    canCacheRequest(request: AvirxBuiltRequest): boolean;
    canCacheResponse(response: AvirxResponse): boolean;
    get(request: AvirxBuiltRequest): AvirxResponse | undefined;
    maxBytes?: number;
    set(request: AvirxBuiltRequest, response: AvirxResponse): Promise<void>;
    size(): number;
    ttlMs: number;
}>;

export type AvirxAuthTokenProvider = () => Promise<string> | string;

export type AvirxAuthPolicy = Readonly<{
    kind: 'api-key-header';
    key: AvirxAuthTokenProvider;
    name: string;
}> | Readonly<{
    kind: 'api-key-query';
    key: AvirxAuthTokenProvider;
    name: string;
}> | Readonly<{
    kind: 'basic';
    password: string;
    username: string;
}> | Readonly<{
    kind: 'bearer';
    token: AvirxAuthTokenProvider;
}>;

export type AvirxAuthState = Readonly<{
    key: '[redacted]';
    kind: 'api-key-header';
    name: string;
}> | Readonly<{
    key: '[redacted]';
    kind: 'api-key-query';
    name: string;
}> | Readonly<{
    kind: 'basic';
    password: '[redacted]';
    username: string;
}> | Readonly<{
    kind: 'bearer';
    token: '[redacted]';
}>;

export type AvirxAuthBuilder<Owner> = Readonly<{
    apiKey(name: string, key: AvirxAuthTokenProvider): Owner;
    basic(username: string, password: string): Owner;
    bearer(token: AvirxAuthTokenProvider): Owner;
    query(name: string, key: AvirxAuthTokenProvider): Owner;
}>;

export type AvirxRetryInput = number | Readonly<{
    attempts: number;
    on?: readonly number[];
}>;

export type AvirxRetryEvent = Readonly<{
    attempt: number;
    delayMs: number;
    status: number;
}>;

export type AvirxRetryMetadata = Readonly<{
    attempts: number;
    on: readonly number[];
    safeOnly: boolean;
}>;

export type AvirxHookEvent = 'error' | 'request' | 'response' | 'retry';

export type AvirxHookContext = Readonly<{
    error(): AvirxError | undefined;
    request(): AvirxBuiltRequest;
    response(): AvirxResponse | undefined;
    retry(): AvirxRetryEvent | undefined;
}>;

export type AvirxHookHandler = (context: AvirxHookContext) => Promise<void> | void;

export type AvirxHookRegistry = Readonly<Record<AvirxHookEvent, readonly AvirxHookHandler[]>>;
