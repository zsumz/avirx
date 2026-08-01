import { resolveAuthHeaders } from '../policy/auth/auth.js';
import type { ResolvedAuth } from '../policy/auth/auth.js';
import { getRawAuthPolicy } from '../policy/auth/state-redaction.js';
import type {
    AvirxAuthPolicy,
    AvirxClientState,
    AvirxRequestState,
} from '../types.js';

export function getEffectiveAuthPolicy(
    clientState: AvirxClientState,
    requestState: AvirxRequestState,
): AvirxAuthPolicy | undefined {
    return getRawAuthPolicy(requestState) ?? getRawAuthPolicy(clientState);
}

export async function resolveEffectiveAuth(
    clientState: AvirxClientState,
    requestState: AvirxRequestState,
): Promise<ResolvedAuth> {
    return resolveAuthHeaders(getEffectiveAuthPolicy(clientState, requestState));
}
