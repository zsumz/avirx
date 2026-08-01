import type { AvirxDurationInput } from './duration.js';
import type { AvirxBuiltRequest } from './request.js';

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
