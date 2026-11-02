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
    if ('then' in contract) {
        throw new TypeError('Contract endpoint name "then" is reserved.');
    }
    if (Object.getOwnPropertySymbols(contract).length > 0) {
        throw new TypeError('Contract endpoint names must be strings.');
    }
    const calls: Partial<Record<keyof Contract, unknown>> = {};

    for (const key of Object.getOwnPropertyNames(contract) as Array<keyof Contract>) {
        Object.defineProperty(calls, key, {
            enumerable: true,
            value: createContractCall(clientState, contract[key]),
        });
    }

    return Object.freeze(calls) as AvirxContractClient<Contract>;
}
