import { runHooks } from '../policy/hooks/hooks.js';
import { createAvirxResponse } from '../response/create-response.js';
import { createHookContext } from './hooks.js';
import { discardResponse } from './response-disposal.js';
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
    try {
        await runHooks(hooks, 'response', createHookContext(request, { response }));
    } catch (error) {
        discardResponse(native);
        throw error;
    }
    return response;
}
