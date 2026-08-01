import type {
    AvirxAuthPolicy,
    AvirxAuthState,
    AvirxClientState,
    AvirxRequestState,
} from '../../types.js';

const rawAuthPolicies: WeakMap<object, AvirxAuthPolicy> = new WeakMap();

export function getRawAuthPolicy(
    state: AvirxClientState | AvirxRequestState,
): AvirxAuthPolicy | undefined {
    return rawAuthPolicies.get(state);
}

export function rememberRawAuthPolicy(
    state: AvirxClientState | AvirxRequestState,
    policy: AvirxAuthPolicy | undefined,
): void {
    if (policy) {
        rawAuthPolicies.set(state, policy);
    }
}

export function createPublicAuthState(policy: AvirxAuthPolicy): AvirxAuthState {
    if (policy.kind === 'api-key-header' || policy.kind === 'api-key-query') {
        return Object.freeze({
            key: '[redacted]',
            kind: policy.kind,
            name: policy.name,
        });
    }

    if (policy.kind === 'basic') {
        return Object.freeze({
            kind: 'basic',
            password: '[redacted]',
            username: policy.username,
        });
    }

    return Object.freeze({
        kind: 'bearer',
        token: '[redacted]',
    });
}
