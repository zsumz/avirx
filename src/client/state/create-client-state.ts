import { freezeClientState } from './freeze-client-state.js';
import type { MutableClientState } from './client-state-types.js';
import type { AvirxClientState } from '../../types.js';

export function createClientState(
    baseUrl: URL,
    options: Pick<AvirxClientState, 'fetch'> = {},
): AvirxClientState {
    const state: MutableClientState = {
        baseUrl: new URL(baseUrl.href),
        headers: Object.freeze({}),
    };
    if (options.fetch) {
        state.fetch = options.fetch;
    }
    return freezeClientState(state);
}
