import { AvirxError } from '../error/avirx-error.js';
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
        const error = new AvirxError('Failed to read response body.', {
            cause,
            request: response.request,
            response,
            status: response.status,
        });
        await runTerminalErrorHooks(clientState, state, error, response);
        throw error;
    }
}
