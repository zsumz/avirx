import { createBodyError } from './body-error.js';
import { runTerminalErrorHooks } from '../execution/hooks.js';
import type { AvirxClientState, AvirxRequestState, AvirxResponse } from '../types.js';

export async function readTerminalBody<T>(
    clientState: AvirxClientState,
    state: AvirxRequestState,
    response: AvirxResponse,
    read: () => Promise<T>,
): Promise<T> {
    try {
        return await read();
    } catch (cause) {
        const error = createBodyError(response, 'Failed to read response body.', cause);
        await runTerminalErrorHooks(clientState, state, error, response);
        throw error;
    }
}
