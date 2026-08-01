import type {
    AvirxClientState,
    AvirxRequestBuilder,
    AvirxRequestState,
} from '../types.js';

export type RequestBuilderContext<
    Route extends string,
    CanHaveBody extends boolean,
    ErrorData,
> = Readonly<{
    clientState: AvirxClientState;
    rebuild<NextErrorData = ErrorData>(
        state: AvirxRequestState,
    ): AvirxRequestBuilder<Route, CanHaveBody, NextErrorData>;
    rebuildWithBody<NextErrorData = ErrorData>(
        clientState: AvirxClientState,
        state: AvirxRequestState,
    ): AvirxRequestBuilder<Route, true, NextErrorData>;
    state: AvirxRequestState;
}>;
