import { createMultipartBuilder } from './multipart.js';
import { forkRequestState } from './state/fork-request-state.js';
import { prepareBodyState } from '../transport/body-state.js';
import { normalizeQuery } from '../transport/query.js';
import type { RequestBuilderContext } from './request-builder-context.js';
import type {
    AvirxBodyValue,
    AvirxPathParams,
    AvirxQueryInput,
} from '../types.js';

export function createRequestInput<
    Route extends string,
    CanHaveBody extends boolean,
    ErrorData,
>(
    context: RequestBuilderContext<Route, CanHaveBody, ErrorData>,
): Readonly<Record<string, unknown>> {
    return {
        body(body: AvirxBodyValue) {
            rejectBodylessMethod(context.state.method, 'body');
            const state = prepareBodyState(
                context.clientState.headers,
                context.state,
                body,
            );
            return context.rebuild(forkRequestState(context.state, state));
        },
        multipart() {
            rejectBodylessMethod(context.state.method, 'multipart body');
            const state = forkRequestState(
                context.state,
                prepareBodyState(context.clientState.headers, context.state, new FormData()),
            );
            return createMultipartBuilder<Route, ErrorData>(
                context.clientState,
                state,
                (clientState, nextState) => context.rebuildWithBody(clientState, nextState),
            );
        },
        path(params: AvirxPathParams<Route>) {
            return context.rebuild(forkRequestState(context.state, { pathParams: params }));
        },
        query(query: AvirxQueryInput) {
            return context.rebuild(forkRequestState(context.state, {
                query: {
                    ...context.state.query,
                    ...normalizeQuery(query),
                },
            }));
        },
    };
}

function rejectBodylessMethod(method: string, bodyKind: string): void {
    if (method === 'GET' || method === 'HEAD') {
        throw new TypeError(`${method} requests cannot have a ${bodyKind}.`);
    }
}
