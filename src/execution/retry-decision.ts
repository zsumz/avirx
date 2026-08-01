import { calculateRetryDelayMs, canRetryMethod } from '../policy/retry/retry.js';
import { isExpectedStatus } from '../transport/status.js';
import type {
    AvirxRequestState,
    AvirxResponse,
    AvirxRetryEvent,
} from '../types.js';

export function shouldRetryResponse(
    response: AvirxResponse,
    state: AvirxRequestState,
    attempt: number,
): boolean {
    const retry = response.request.retry;
    if (!retry || attempt >= retry.attempts) {
        return false;
    }
    if (isExpectedStatus(response.status, state.expectedStatuses)) {
        return false;
    }
    if (!retry.on.includes(response.status)) {
        return false;
    }

    return canRetryMethod(response.request.method, retry) && canReplayBody(response.request);
}

export function createRetryEvent(
    attempt: number,
    response: AvirxResponse,
): AvirxRetryEvent {
    return Object.freeze({
        attempt,
        delayMs: calculateRetryDelayMs(attempt, response.headers['retry-after']),
        status: response.status,
    });
}

function canReplayBody(request: AvirxResponse['request']): boolean {
    if (!('body' in request)) {
        return true;
    }

    return request.bodyMetadata.kind !== 'form' && request.bodyMetadata.kind !== 'stream';
}
