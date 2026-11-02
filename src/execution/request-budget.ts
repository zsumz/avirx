import type { AvirxBuiltRequest, AvirxClientState } from '../types.js';

export async function acquireRequestBudget(
    clientState: AvirxClientState,
    request: AvirxBuiltRequest,
    signal: AbortSignal | undefined,
): Promise<() => void> {
    const release = await clientState.concurrency?.acquire(signal) ?? noop;
    try {
        await clientState.rateLimit?.acquire(request, signal);
        return release;
    } catch (error) {
        release();
        throw error;
    }
}

function noop(): void {
    return;
}
