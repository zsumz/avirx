import { createRequestBuilder } from '../request/create-request-builder.js';
import { parseWithSchema } from './schema.js';
import { validateContractBody } from './validate-contract-body.js';
import { validateContractPathParams } from './validate-contract-path.js';
import { validateContractQuery } from './validate-contract-query.js';
import type { ContractInputRecord, ContractRequestBuilder } from './contract-request-builder.js';
import type {
    AvirxAnyEndpointDefinition,
    AvirxClientState,
    AvirxContractInput,
} from '../types.js';

export async function prepareContractRequest<Endpoint extends AvirxAnyEndpointDefinition>(
    clientState: AvirxClientState,
    definition: Endpoint,
    input: AvirxContractInput<Endpoint>,
): Promise<ContractRequestBuilder> {
    const values = input as ContractInputRecord;
    const state = definition.state;
    let request = createRequestBuilder(
        clientState,
        state.method,
        state.path,
    ) as unknown as ContractRequestBuilder;

    if (state.paramsSchema) {
        request = request.path(validateContractPathParams(
            state.path,
            await parseWithSchema(state.paramsSchema, values.path),
        ));
    } else if (values.path !== undefined) {
        request = request.path(validateContractPathParams(state.path, values.path));
    }

    if (state.querySchema) {
        request = request.query(validateContractQuery(await parseWithSchema(state.querySchema, values.query)));
    } else if (values.query !== undefined) {
        throw new TypeError(`Contract endpoint "${state.path}" does not accept query input.`);
    }

    if (state.bodySchema) {
        request = request.body(validateContractBody(await parseWithSchema(state.bodySchema, values.body)));
    } else if (values.body !== undefined) {
        throw new TypeError(`Contract endpoint "${state.path}" does not accept body input.`);
    }

    return request;
}
