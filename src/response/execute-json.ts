import { AvirxError } from '../error/avirx-error.js';
import { writeCacheResponse } from '../execution/cache.js';
import { executeExpectedRequest } from '../execution/execute-expected-request.js';
import { runTerminalErrorHooks } from '../execution/hooks.js';
import { readTerminalJson } from './terminal-json.js';
import type { AvirxClientState, AvirxRequestState } from '../types.js';

export async function executeJson<T>(
    clientState: AvirxClientState,
    state: AvirxRequestState,
): Promise<T> {
    const response = await executeExpectedRequest(clientState, state);
    if (response.status === 204 || response.status === 205) {
        await writeCacheResponse(clientState, response);
        return undefined as T;
    }
    try {
        const data = await readTerminalJson(response) as T;
        await writeCacheResponse(clientState, response);
        return data;
    } catch (error) {
        if (error instanceof AvirxError) {
            await runTerminalErrorHooks(clientState, state, error, response);
        }
        throw error;
    }
}
