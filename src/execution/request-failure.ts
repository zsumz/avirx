import { AvirxError } from '../error/avirx-error.js';
import type { AvirxBuiltRequest } from '../types.js';

export function createRequestFailure(
    cause: unknown,
    request: AvirxBuiltRequest,
    timeoutSignal: AbortSignal | undefined,
    externalSignal: AbortSignal | undefined,
    fetchSignal: AbortSignal | undefined,
): AvirxError {
    const signal = fetchSignal?.aborted ? fetchSignal : externalSignal?.aborted ? externalSignal : undefined;
    if (signal) {
        const timedOut = timeoutSignal?.aborted && signal.reason === timeoutSignal.reason;
        return new AvirxError(timedOut ? 'Request timed out.' : 'Request aborted.', {
            cause: signal.reason,
            kind: timedOut ? 'timeout' : 'aborted',
            request,
        });
    }
    if (cause instanceof AvirxError && cause.request === request
        && (cause.kind === 'queue-full' || cause.kind === 'queue-timeout')) {
        return cause;
    }
    return new AvirxError('Request failed.', { cause, kind: 'network', request });
}
