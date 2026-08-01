import type {
    AvirxAuthPolicy,
    AvirxCachePolicy,
    AvirxClientState,
    AvirxConcurrencyLimiter,
    AvirxHeaders,
    AvirxHookRegistry,
    AvirxRateLimitLimiter,
    AvirxRetryMetadata,
} from '../../types.js';

export interface MutableClientState {
    auth?: AvirxAuthPolicy;
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
}

export type ClientStatePatch = Partial<Omit<MutableClientState, 'baseUrl'>>;

export type PublicClientStateSnapshot = {
    -readonly [Key in keyof AvirxClientState]?: AvirxClientState[Key];
};
