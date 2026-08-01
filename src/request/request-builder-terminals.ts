import { executeDownload } from '../response/download.js';
import {
    executeAs,
    executeJson,
    executeResult,
    executeSend,
    executeText,
} from '../response/terminals.js';
import type { RequestBuilderContext } from './request-builder-context.js';
import type { AvirxResult, AvirxSchema } from '../types.js';

export function createRequestTerminals<
    Route extends string,
    CanHaveBody extends boolean,
    ErrorData,
>(
    context: RequestBuilderContext<Route, CanHaveBody, ErrorData>,
): Readonly<Record<string, unknown>> {
    return {
        async as<Schema extends AvirxSchema<unknown>>(schema: Schema) {
            return executeAs(context.clientState, context.state, schema);
        },
        async download() {
            return executeDownload(context.clientState, context.state);
        },
        async json<T = unknown>() {
            return executeJson<T>(context.clientState, context.state);
        },
        async result(schema?: AvirxSchema<unknown>): Promise<AvirxResult<unknown, ErrorData>> {
            return executeResult<ErrorData>(context.clientState, context.state, schema);
        },
        async send() {
            return executeSend(context.clientState, context.state);
        },
        async text() {
            return executeText(context.clientState, context.state);
        },
    };
}
