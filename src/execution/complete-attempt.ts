import { runHooks } from '../policy/hooks/hooks.js';
import { createAvirxResponse } from '../response/create-response.js';
import { createHookContext } from './hooks.js';
import type {
    AvirxBuiltRequest,
    AvirxHookRegistry,
    AvirxResponse,
    AvirxRetryEvent,
} from '../types.js';

export async function completeRequestAttempt(
    native: Response,
    request: AvirxBuiltRequest,
    startedAt: number,
    retryEvents: readonly AvirxRetryEvent[],
    hooks: AvirxHookRegistry,
): Promise<AvirxResponse> {
    const endedAt = Date.now();
    const response = createAvirxResponse(
        native,
        request,
        Object.freeze({
            durationMs: endedAt - startedAt,
            endedAt,
            ...retryEvents.length > 0 ? { retryEvents: Object.freeze([...retryEvents]) } : {},
            startedAt,
        }),
    );
    await runHooks(hooks, 'response', createHookContext(request, { response }));
    return response;
}
