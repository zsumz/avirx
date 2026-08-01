import { createEndpointDefinition } from './create-endpoint-definition.js';
import { freezeEndpointState } from './endpoint-state.js';
import type {
    AvirxEndpointDefinition,
    AvirxEndpointState,
    HttpMethod,
} from '../types.js';

export function createEndpoint<Method extends HttpMethod, const Path extends string>(
    method: Method,
    path: Path,
): AvirxEndpointDefinition<Method, Path> {
    const state = freezeEndpointState({
        bodySchema: undefined,
        method,
        paramsSchema: undefined,
        path,
        querySchema: undefined,
        responseSchema: undefined,
    }) as AvirxEndpointState<Method, Path>;

    return createEndpointDefinition(state);
}
