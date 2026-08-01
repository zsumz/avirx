import {
    createApiKeyHeaderAuth,
    createApiKeyQueryAuth,
    createBasicAuth,
    createBearerAuth,
} from '../policy/auth/auth-policy.js';
import { forkRequestState } from './state/fork-request-state.js';
import type { RequestBuilderContext } from './request-builder-context.js';
import type { AvirxAuthTokenProvider } from '../types.js';

export function createRequestAuth<
    Route extends string,
    CanHaveBody extends boolean,
    ErrorData,
>(
    context: RequestBuilderContext<Route, CanHaveBody, ErrorData>,
): Readonly<Record<string, unknown>> {
    return {
        auth: Object.freeze({
            apiKey(name: string, key: AvirxAuthTokenProvider) {
                return context.rebuild(forkRequestState(context.state, {
                    auth: createApiKeyHeaderAuth(name, key),
                }));
            },
            basic(username: string, password: string) {
                return context.rebuild(forkRequestState(context.state, {
                    auth: createBasicAuth(username, password),
                }));
            },
            bearer(token: AvirxAuthTokenProvider) {
                return context.rebuild(forkRequestState(context.state, {
                    auth: createBearerAuth(token),
                }));
            },
            query(name: string, key: AvirxAuthTokenProvider) {
                return context.rebuild(forkRequestState(context.state, {
                    auth: createApiKeyQueryAuth(name, key),
                }));
            },
        }),
    };
}
