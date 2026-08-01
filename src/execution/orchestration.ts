import { mergeHooks } from '../policy/hooks/hooks.js';
import { isExpectedStatus } from '../transport/status.js';
import { createUnexpectedStatusError } from './errors.js';
import { runErrorHooks } from './hooks.js';
import { executeRequest } from './retry.js';
import type {
    AvirxClientState,
    AvirxRequestState,
    AvirxResponse,
} from '../types.js';

export { writeCacheResponse } from './cache.js';
export {
    createUnexpectedStatusError,
    readJsonBody,
} from './errors.js';
export {
    runErrorHooks,
    runTerminalErrorHooks,
} from './hooks.js';
export { executeRequest } from './retry.js';

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
