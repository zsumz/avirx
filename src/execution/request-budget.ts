import type { AvirxBuiltRequest, AvirxClientState } from '../types.js';

export async function acquireRequestBudget(
    clientState: AvirxClientState,
    request: AvirxBuiltRequest,
    signal: AbortSignal | undefined,
): Promise<() => void> {
    await clientState.rateLimit?.acquire(request, signal);
    return clientState.concurrency?.acquire(signal) ?? noop;
}

function noop(): void {
    return;
}
