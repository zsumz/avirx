import { writeCacheResponse } from '../execution/cache.js';
import { executeExpectedRequest } from '../execution/execute-expected-request.js';
import { readTextResponse } from './read-response.js';
import { readTerminalBody } from './read-terminal-body.js';
import type { AvirxClientState, AvirxRequestState } from '../types.js';

export async function executeText(
    clientState: AvirxClientState,
    state: AvirxRequestState,
): Promise<string> {
    const response = await executeExpectedRequest(clientState, state);
    const data = await readTerminalBody(clientState, state, response, async () => readTextResponse(response.native));
    await writeCacheResponse(clientState, response);
    return data;
}
