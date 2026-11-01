import { createContractCall } from './create-contract-call.js';
import type {
    AvirxClientState,
    AvirxContractClient,
    AvirxEndpointContract,
} from '../types.js';

export function createContractClient<Contract extends AvirxEndpointContract>(
    clientState: AvirxClientState,
    contract: Contract,
): AvirxContractClient<Contract> {
    const calls: Partial<Record<keyof Contract, unknown>> = {};

    for (const key of Object.keys(contract) as Array<keyof Contract>) {
        Object.defineProperty(calls, key, {
            enumerable: true,
            value: createContractCall(clientState, contract[key]),
        });
    }

    return Object.freeze(calls) as AvirxContractClient<Contract>;
}
