import type {
    AvirxBodyValue,
    AvirxPrimitiveValue,
    AvirxQueryInput,
    AvirxResult,
    AvirxRequestState,
    AvirxSchema,
} from '../types.js';

export type ContractRequestBuilder = Readonly<{
    as(schema: AvirxSchema<unknown>): Promise<unknown>;
    body(body: AvirxBodyValue): ContractRequestBuilder;
    json<T = unknown>(): Promise<T>;
    path(params: Readonly<Record<string, AvirxPrimitiveValue>>): ContractRequestBuilder;
    query(query: AvirxQueryInput): ContractRequestBuilder;
    result(schema?: AvirxSchema<unknown>): Promise<AvirxResult<unknown>>;
    state: AvirxRequestState;
}>;

export type ContractInputRecord = Readonly<Record<'body' | 'path' | 'query', unknown>>;
