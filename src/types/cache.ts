import type { AvirxDurationInput } from './duration.js';
import type { AvirxBuiltRequest } from './request.js';
import type { AvirxResponse } from './response.js';

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
