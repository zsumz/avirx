import { executeExpectedRequest } from '../execution/execute-expected-request.js';
import type { AvirxClientState, AvirxRequestState, AvirxResponse } from '../types.js';

export async function executeSend(
    clientState: AvirxClientState,
    state: AvirxRequestState,
): Promise<AvirxResponse> {
    return executeExpectedRequest(clientState, state);
}
