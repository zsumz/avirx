import { appendHook } from '../policy/hooks/hooks.js';
import { normalizeRetry } from '../policy/retry/retry.js';
import { normalizeDurationMs } from '../time/duration.js';
import { normalizeHeader, normalizeHeaders } from '../transport/headers.js';
import { normalizeExpectedStatuses } from '../transport/status.js';
import { forkRequestState } from './state/fork-request-state.js';
import type { RequestBuilderContext } from './request-builder-context.js';
import type {
    AvirxHeaders,
    AvirxHookEvent,
    AvirxHookHandler,
    AvirxInferSchema,
    AvirxRequestTimeoutInput,
    AvirxRequestBuilder,
    AvirxRetryInput,
    AvirxSchema,
} from '../types.js';

export function createRequestMetadata<
    Route extends string,
    CanHaveBody extends boolean,
    ErrorData,
>(
    context: RequestBuilderContext<Route, CanHaveBody, ErrorData>,
): Readonly<Record<string, unknown>> {
    const patch = (
        value: Parameters<typeof forkRequestState>[1],
    ): AvirxRequestBuilder<Route, CanHaveBody, ErrorData> =>
        context.rebuild(forkRequestState(context.state, value));
    return {
        error<Schema extends AvirxSchema<unknown>>(schema: Schema) {
            return context.rebuild<AvirxInferSchema<Schema>>(
                forkRequestState(context.state, { errorSchema: schema }),
            );
        },
        expect(statuses: number | readonly number[]) {
            return patch({ expectedStatuses: normalizeExpectedStatuses(statuses) });
        },
        header(name: string, value: string) {
            return patch({
                headers: { ...context.state.headers, ...normalizeHeader(name, value) },
            });
        },
        headers(headers: HeadersInit | AvirxHeaders) {
            return patch({
                headers: { ...context.state.headers, ...normalizeHeaders(headers) },
            });
        },
        on(event: AvirxHookEvent, handler: AvirxHookHandler) {
            return patch({ hooks: appendHook(context.state.hooks, event, handler) });
        },
        retry(input: AvirxRetryInput) {
            return patch({ retry: normalizeRetry(input) });
        },
        signal(signal: AbortSignal) {
            return patch({ signal });
        },
        timeout(duration: AvirxRequestTimeoutInput) {
            return patch({
                timeoutMs: duration === false ? false : normalizeDurationMs(duration),
            });
        },
    };
}
