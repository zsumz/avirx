import { createRequestBuilder } from './request-builder.js';
import { parseWithSchema } from './schema.js';
import { extractPathParamNames } from './internals/url.js';
import type {
    AvirxBodyValue,
    AvirxAnyEndpointDefinition,
    AvirxClientState,
    AvirxContractCall,
    AvirxContractClient,
    AvirxContractInput,
    AvirxEndpointContract,
    AvirxPrimitiveValue,
    AvirxQueryInput,
    AvirxResult,
    AvirxSchema,
} from './types.js';

type ContractRequestBuilder = Readonly<{
    as(schema: AvirxSchema<unknown>): Promise<unknown>;
    body(body: AvirxBodyValue): ContractRequestBuilder;
    json<T = unknown>(): Promise<T>;
    path(params: Readonly<Record<string, AvirxPrimitiveValue>>): ContractRequestBuilder;
    query(query: AvirxQueryInput): ContractRequestBuilder;
    result(schema?: AvirxSchema<unknown>): Promise<AvirxResult<unknown>>;
}>;
type ContractInputRecord = Readonly<Record<'body' | 'path' | 'query', unknown>>;

export function createContractClient<Contract extends AvirxEndpointContract>(
    clientState: AvirxClientState,
    contract: Contract,
): AvirxContractClient<Contract> {
    const calls: Partial<Record<keyof Contract, unknown>> = {};

    for (const key of Object.keys(contract) as Array<keyof Contract>) {
        calls[key] = createContractCall(clientState, contract[key]);
    }

    return Object.freeze(calls) as AvirxContractClient<Contract>;
}

function createContractCall<Endpoint extends AvirxAnyEndpointDefinition>(
    clientState: AvirxClientState,
    definition: Endpoint,
): AvirxContractCall<Endpoint> {
    const call = async (input: AvirxContractInput<Endpoint>): Promise<unknown> => {
        const request = prepareContractRequest(clientState, definition, input);
        const responseSchema = definition.state.responseSchema;

        if (responseSchema) {
            return request.as(responseSchema);
        }

        return request.json();
    };

    return Object.freeze(
        Object.assign(call, {
            async result(input: AvirxContractInput<Endpoint>): Promise<AvirxResult<unknown>> {
                const request = prepareContractRequest(clientState, definition, input);
                return request.result(definition.state.responseSchema);
            },
        }),
    ) as AvirxContractCall<Endpoint>;
}

function prepareContractRequest<Endpoint extends AvirxAnyEndpointDefinition>(
    clientState: AvirxClientState,
    definition: Endpoint,
    input: AvirxContractInput<Endpoint>,
): ContractRequestBuilder {
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
            parseContractValue(state.paramsSchema, values.path),
        ));
    } else if (values.path !== undefined) {
        request = request.path(validateContractPathParams(state.path, values.path));
    }

    if (state.querySchema) {
        request = request.query(validateContractQuery(parseContractValue(state.querySchema, values.query)));
    } else if (values.query !== undefined) {
        throw new TypeError(`Contract endpoint "${state.path}" does not accept query input.`);
    }

    if (state.bodySchema) {
        request = request.body(validateContractBody(parseContractValue(state.bodySchema, values.body)));
    } else if (values.body !== undefined) {
        throw new TypeError(`Contract endpoint "${state.path}" does not accept body input.`);
    }

    return request;
}

function parseContractValue(
    schema: AvirxSchema<unknown>,
    value: unknown,
): unknown {
    return parseWithSchema(schema, value);
}

function validateContractPathParams(
    route: string,
    value: unknown,
): Readonly<Record<string, AvirxPrimitiveValue>> {
    if (!isPlainRecord(value)) {
        throw new TypeError(`Contract path params for "${route}" must be an object.`);
    }

    const expectedNames = extractPathParamNames(route);
    const providedNames = Object.keys(value);
    const missingNames = expectedNames.filter((name) => !providedNames.includes(name));
    if (missingNames.length > 0) {
        throw new TypeError(
            `Contract path params for "${route}" are missing: ${missingNames.join(', ')}.`,
        );
    }

    const extraNames = providedNames.filter((name) => !expectedNames.includes(name));
    if (extraNames.length > 0) {
        throw new TypeError(
            `Unexpected contract path params for "${route}": ${extraNames.join(', ')}.`,
        );
    }

    const params: Record<string, AvirxPrimitiveValue> = {};
    for (const [name, paramValue] of Object.entries(value)) {
        if (!isPrimitiveValue(paramValue)) {
            throw new TypeError(
                `Contract path param "${name}" must be a string, number, or boolean.`,
            );
        }
        params[name] = paramValue;
    }

    return Object.freeze(params);
}

function validateContractQuery(value: unknown): AvirxQueryInput {
    if (value instanceof URLSearchParams) {
        return value;
    }

    if (!isPlainRecord(value)) {
        throw new TypeError('Contract query schema must parse to URLSearchParams or a query object.');
    }

    for (const [name, queryValue] of Object.entries(value)) {
        if (queryValue === null || queryValue === undefined) {
            continue;
        }

        if (Array.isArray(queryValue)) {
            const queryItems = queryValue as readonly unknown[];
            if (queryItems.some((item) => !isPrimitiveValue(item))) {
                throw new TypeError(
                    `Contract query value "${name}" must be a primitive or an array of primitives.`,
                );
            }
            continue;
        }

        if (!isPrimitiveValue(queryValue)) {
            throw new TypeError(
                `Contract query value "${name}" must be a primitive or an array of primitives.`,
            );
        }
    }

    return value as AvirxQueryInput;
}

function validateContractBody(value: unknown): AvirxBodyValue {
    if (isBodyValue(value)) {
        return value;
    }

    throw new TypeError('Contract body schema must parse to a supported request body value.');
}

function isBodyValue(value: unknown): value is AvirxBodyValue {
    return value === null
    || value === undefined
    || typeof value === 'string'
    || value instanceof ArrayBuffer
    || value instanceof Blob
    || value instanceof FormData
    || value instanceof ReadableStream
    || value instanceof URLSearchParams
    || Array.isArray(value)
    || isPlainRecord(value);
}

function isPlainRecord(value: unknown): value is Readonly<Record<string, unknown>> {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return false;
    }

    const prototype: unknown = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}

function isPrimitiveValue(value: unknown): value is AvirxPrimitiveValue {
    return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}
