import { mergeHooks } from './internals/hooks.js';
import { isExpectedStatus } from './internals/status.js';
import { createUnexpectedStatusError } from './execution-errors.js';
import { runErrorHooks } from './execution-hooks.js';
import { executeRequest } from './execution-retry.js';
import type {
    AvirxClientState,
    AvirxRequestState,
    AvirxResponse,
} from './types.js';

export { writeCacheResponse } from './execution-cache.js';
export {
    createUnexpectedStatusError,
    readJsonBody,
} from './execution-errors.js';
export {
    runErrorHooks,
    runTerminalErrorHooks,
} from './execution-hooks.js';
export { executeRequest } from './execution-retry.js';

export async function executeExpectedRequest(
    clientState: AvirxClientState,
    state: AvirxRequestState,
): Promise<AvirxResponse> {
    const response = await executeRequest(clientState, state);

    if (!isExpectedStatus(response.status, state.expectedStatuses)) {
        const hooks = mergeHooks(clientState.hooks, state.hooks);
        const error = await createUnexpectedStatusError(
            response,
            state.errorSchema,
        );
        await runErrorHooks(hooks, error, response);
        throw error;
    }

    return response;
}
