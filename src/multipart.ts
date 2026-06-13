import { cloneFormData, prepareBodyState } from './internals/body-state.js';
import { forkRequestState } from './internals/request-state.js';
import type {
    AvirxClientState,
    AvirxMultipartBuilder,
    AvirxMultipartFieldValue,
    AvirxMultipartFileValue,
    AvirxRequestBuilder,
    AvirxRequestState,
} from './types.js';

export function createMultipartBuilder<Route extends string, ErrorData>(
    clientState: AvirxClientState,
    state: AvirxRequestState,
    createRequestBuilder: (
        clientState: AvirxClientState,
        state: AvirxRequestState,
    ) => AvirxRequestBuilder<Route, true, ErrorData>,
): AvirxMultipartBuilder<Route, ErrorData> {
    const builder = createRequestBuilder(clientState, state) as AvirxMultipartBuilder<Route, ErrorData>;

    const multipartBuilder = {
        ...builder,
        field(name: string, value: AvirxMultipartFieldValue) {
            const data = cloneFormData(state.body);
            data.append(name, String(value));
            return createMultipartBuilder<Route, ErrorData>(
                clientState,
                forkRequestState(state, prepareBodyState(clientState.headers, state, data)),
                createRequestBuilder,
            );
        },
        file(name: string, value: AvirxMultipartFileValue, filename?: string) {
            const data = cloneFormData(state.body);
            if (filename === undefined) {
                data.append(name, value);
            } else {
                data.append(name, value, filename);
            }
            return createMultipartBuilder<Route, ErrorData>(
                clientState,
                forkRequestState(state, prepareBodyState(clientState.headers, state, data)),
                createRequestBuilder,
            );
        },
    };

    return Object.freeze(multipartBuilder) as unknown as AvirxMultipartBuilder<Route, ErrorData>;
}
