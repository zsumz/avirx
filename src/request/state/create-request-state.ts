import { createReadonlySet } from '../../state/freeze.js';
import { freezeRequestState } from './freeze-request-state.js';
import type { AvirxRequestState, HttpMethod } from '../../types.js';

export function createRequestState(method: HttpMethod, route: string): AvirxRequestState {
    return freezeRequestState({
        expectedStatuses: createReadonlySet<number>(),
        headers: Object.freeze({}),
        method,
        pathParams: Object.freeze({}),
        query: Object.freeze({}),
        route,
    });
}
