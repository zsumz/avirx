import { writeCacheResponse } from '../execution/cache.js';
import { executeExpectedRequest } from '../execution/execute-expected-request.js';
import type { AvirxClientState, AvirxRequestState, AvirxResponse } from '../types.js';

export async function executeSend(
    clientState: AvirxClientState,
    state: AvirxRequestState,
): Promise<AvirxResponse> {
    const response = await executeExpectedRequest(clientState, state);
    await writeCacheResponse(clientState, response);
    return response;
}
