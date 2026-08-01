import type { AvirxResult } from './response.js';
import type {
    AvirxAnyEndpointDefinition,
    AvirxEndpointContract,
    AvirxEndpointDefinition,
} from './endpoint.js';
import type { AvirxBodyValue } from './body.js';
import type { HttpMethod } from './http.js';
import type {
    AvirxPathParamNames,
    AvirxPathParams,
    AvirxQueryInput,
} from './request.js';
import type { AvirxInferSchema, AvirxSchema } from './schema.js';

export type AvirxContractInput<Endpoint extends AvirxAnyEndpointDefinition> =
    Endpoint extends AvirxEndpointDefinition<
        HttpMethod,
        infer Path,
        infer ParamsSchema,
        infer QuerySchema,
        infer BodySchema,
    AvirxSchema<unknown> | undefined
    >
        ? Readonly<
        (ParamsSchema extends AvirxSchema<unknown>
            ? { path: AvirxInferSchema<ParamsSchema> }
            : [AvirxPathParamNames<Path>] extends [never]
                ? { path?: never }
                : { path: AvirxPathParams<Path> }) &
          (QuerySchema extends AvirxSchema<AvirxQueryInput>
              ? { query: AvirxInferSchema<QuerySchema> }
              : { query?: never }) &
          (BodySchema extends AvirxSchema<AvirxBodyValue>
              ? { body: AvirxInferSchema<BodySchema> }
              : { body?: never })
        >
        : never;

export type AvirxContractOutput<Endpoint extends AvirxAnyEndpointDefinition> =
    Endpoint extends AvirxEndpointDefinition<
        HttpMethod,
        string,
    AvirxSchema<unknown> | undefined,
    AvirxSchema<unknown> | undefined,
    AvirxSchema<unknown> | undefined,
    infer ResponseSchema
    >
        ? ResponseSchema extends AvirxSchema<unknown>
            ? AvirxInferSchema<ResponseSchema>
            : unknown
        : unknown;

export type AvirxContractCall<Endpoint extends AvirxAnyEndpointDefinition> = ((
    input: AvirxContractInput<Endpoint>,
) => Promise<AvirxContractOutput<Endpoint>>) & Readonly<{
    result(input: AvirxContractInput<Endpoint>): Promise<AvirxResult<AvirxContractOutput<Endpoint>>>;
}>;

export type AvirxContractClient<Contract extends AvirxEndpointContract> = Readonly<{
    [Key in keyof Contract]: AvirxContractCall<Contract[Key]>;
}>;
