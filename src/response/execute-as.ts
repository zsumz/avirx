import { AvirxError } from '../error/avirx-error.js';
import { writeCacheResponse } from '../execution/cache.js';
import { executeExpectedRequest } from '../execution/execute-expected-request.js';
import { runTerminalErrorHooks } from '../execution/hooks.js';
import { parseWithSchema } from '../contract/schema.js';
import { createValidationError, readTerminalJson } from './terminal-json.js';
import type {
    AvirxClientState,
    AvirxInferSchema,
    AvirxRequestState,
    AvirxSchema,
} from '../types.js';

export async function executeAs<Schema extends AvirxSchema<unknown>>(
    clientState: AvirxClientState,
    state: AvirxRequestState,
    schema: Schema,
): Promise<AvirxInferSchema<Schema>> {
    const response = await executeExpectedRequest(clientState, state);
    let data: unknown;
    try {
        data = await readTerminalJson(response);
    } catch (error) {
        if (error instanceof AvirxError) {
            await runTerminalErrorHooks(clientState, state, error, response);
        }
        throw error;
    }
    try {
        const parsed = await Promise.resolve(parseWithSchema(schema, data));
        await writeCacheResponse(clientState, response);
        return parsed;
    } catch (cause) {
        const error = createValidationError(response, data, cause);
        await runTerminalErrorHooks(clientState, state, error, response);
        throw error;
    }
}
