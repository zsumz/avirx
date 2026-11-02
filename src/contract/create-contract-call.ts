import { prepareContractRequest } from './prepare-contract-request.js';
import type {
    AvirxAnyEndpointDefinition,
    AvirxClientState,
    AvirxContractCall,
    AvirxContractInput,
    AvirxResult,
} from '../types.js';

export function createContractCall<Endpoint extends AvirxAnyEndpointDefinition>(
    clientState: AvirxClientState,
    definition: Endpoint,
): AvirxContractCall<Endpoint> {
    const call = async (input: AvirxContractInput<Endpoint>): Promise<unknown> => {
        const request = await prepareContractRequest(clientState, definition, input);
        const responseSchema = definition.state.responseSchema;
        return responseSchema ? request.as(responseSchema) : request.json();
    };

    return Object.freeze(
        Object.assign(call, {
            async result(input: AvirxContractInput<Endpoint>): Promise<AvirxResult<unknown>> {
                const request = await prepareContractRequest(clientState, definition, input);
                return request.result(definition.state.responseSchema);
            },
        }),
    ) as AvirxContractCall<Endpoint>;
}
