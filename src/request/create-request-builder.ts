import { createRequestAuth } from './request-builder-auth.js';
import { createRequestInput } from './request-builder-input.js';
import { createRequestInspection } from './request-builder-inspection.js';
import { createRequestMetadata } from './request-builder-metadata.js';
import { createRequestTerminals } from './request-builder-terminals.js';
import { createRequestState } from './state/create-request-state.js';
import type { RequestBuilderContext } from './request-builder-context.js';
import type {
    AvirxClientState,
    AvirxRequestBuilder,
    AvirxRequestState,
    HttpMethod,
} from '../types.js';

type BodyAllowedForMethod<Method extends HttpMethod> =
    Method extends 'GET' | 'HEAD' ? false : true;

export function createRequestBuilder<Method extends HttpMethod, Route extends string>(
    clientState: AvirxClientState,
    method: Method,
    route: Route,
): AvirxRequestBuilder<Route, BodyAllowedForMethod<Method>> {
    return createRequestBuilderFromState<Route, BodyAllowedForMethod<Method>>(
        clientState,
        createRequestState(method, route),
    );
}

function createRequestBuilderFromState<
    Route extends string,
    CanHaveBody extends boolean,
    ErrorData = unknown,
>(
    clientState: AvirxClientState,
    state: AvirxRequestState,
): AvirxRequestBuilder<Route, CanHaveBody, ErrorData> {
    const context: RequestBuilderContext<Route, CanHaveBody, ErrorData> = {
        clientState,
        rebuild: <NextErrorData = ErrorData>(nextState: AvirxRequestState) =>
            createRequestBuilderFromState<Route, CanHaveBody, NextErrorData>(clientState, nextState),
        rebuildWithBody: <NextErrorData = ErrorData>(
            nextClientState: AvirxClientState,
            nextState: AvirxRequestState,
        ) =>
            createRequestBuilderFromState<Route, true, NextErrorData>(nextClientState, nextState),
        state,
    };
    const builder = {
        ...createRequestAuth(context),
        ...createRequestInput(context),
        ...createRequestInspection(context),
        ...createRequestMetadata(context),
        ...createRequestTerminals(context),
        clientState,
        state,
    };
    return Object.freeze(builder) as unknown as AvirxRequestBuilder<Route, CanHaveBody, ErrorData>;
}
