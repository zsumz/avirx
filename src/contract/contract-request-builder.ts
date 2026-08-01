import type {
    AvirxBodyValue,
    AvirxPrimitiveValue,
    AvirxQueryInput,
    AvirxResult,
    AvirxSchema,
} from '../types.js';

export type ContractRequestBuilder = Readonly<{
    as(schema: AvirxSchema<unknown>): Promise<unknown>;
    body(body: AvirxBodyValue): ContractRequestBuilder;
    json<T = unknown>(): Promise<T>;
    path(params: Readonly<Record<string, AvirxPrimitiveValue>>): ContractRequestBuilder;
    query(query: AvirxQueryInput): ContractRequestBuilder;
    result(schema?: AvirxSchema<unknown>): Promise<AvirxResult<unknown>>;
}>;

export type ContractInputRecord = Readonly<Record<'body' | 'path' | 'query', unknown>>;
