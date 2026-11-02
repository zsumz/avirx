import { freezeClientState } from './freeze-client-state.js';
import { rejectUrlCredentials } from '../../transport/url.js';
import type { MutableClientState } from './client-state-types.js';
import type { AvirxClientState } from '../../types.js';

export function createClientState(
    baseUrl: URL,
    options: Pick<AvirxClientState, 'allowCredentialRedirects' | 'fetch'> = {},
): AvirxClientState {
    rejectUrlCredentials(baseUrl);
    if (options.allowCredentialRedirects !== undefined && typeof options.allowCredentialRedirects !== 'boolean') {
        throw new TypeError('allowCredentialRedirects must be a boolean.');
    }
    const state: MutableClientState = {
        baseUrl: new URL(baseUrl.href),
        headers: Object.freeze({}),
    };
    if (options.fetch) {
        state.fetch = options.fetch;
    }
    if (options.allowCredentialRedirects !== undefined) {
        state.allowCredentialRedirects = options.allowCredentialRedirects;
    }
    return freezeClientState(state);
}
