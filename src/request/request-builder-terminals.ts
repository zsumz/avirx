import { executeAs } from '../response/execute-as.js';
import { executeDownload } from '../response/execute-download.js';
import { executeJson } from '../response/execute-json.js';
import { executeResult } from '../response/execute-result.js';
import { executeSend } from '../response/execute-send.js';
import { executeText } from '../response/execute-text.js';
import { exposeCallbackFailure } from '../error/callback-failure.js';
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
            return exposeCallbackFailure(async () => executeAs(context.clientState, context.state, schema));
        },
        async download() {
            return exposeCallbackFailure(async () => executeDownload(context.clientState, context.state));
        },
        async json<T = unknown>() {
            return exposeCallbackFailure(async () => executeJson<T>(context.clientState, context.state));
        },
        async result(schema?: AvirxSchema<unknown>): Promise<AvirxResult<unknown, ErrorData>> {
            return exposeCallbackFailure(async () =>
                executeResult<ErrorData>(context.clientState, context.state, schema));
        },
        async send() {
            return exposeCallbackFailure(async () => executeSend(context.clientState, context.state));
        },
        async text() {
            return exposeCallbackFailure(async () => executeText(context.clientState, context.state));
        },
    };
}
