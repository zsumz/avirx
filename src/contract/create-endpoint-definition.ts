import { freezeEndpointState } from './endpoint-state.js';
import type {
    AvirxBodyValue,
    AvirxEndpointDefinition,
    AvirxEndpointState,
    AvirxPathParams,
    AvirxQueryInput,
    AvirxSchema,
    HttpMethod,
} from '../types.js';

export function createEndpointDefinition<
    Method extends HttpMethod,
    Path extends string,
    ParamsSchema extends AvirxSchema<unknown> | undefined = undefined,
    QuerySchema extends AvirxSchema<unknown> | undefined = undefined,
    BodySchema extends AvirxSchema<unknown> | undefined = undefined,
    ResponseSchema extends AvirxSchema<unknown> | undefined = undefined,
>(
    state: AvirxEndpointState<Method, Path, ParamsSchema, QuerySchema, BodySchema, ResponseSchema>,
): AvirxEndpointDefinition<Method, Path, ParamsSchema, QuerySchema, BodySchema, ResponseSchema> {
    const definition = {
        body<Schema extends AvirxSchema<AvirxBodyValue | PromiseLike<AvirxBodyValue>>>(schema: Schema) {
            if (state.method === 'GET' || state.method === 'HEAD') {
                throw new TypeError(`${state.method} endpoint contracts cannot define a body schema.`);
            }

            return createEndpointDefinition(
                freezeEndpointState({ ...state, bodySchema: schema }) as AvirxEndpointState<
                    Method,
                    Path,
                    ParamsSchema,
                    QuerySchema,
                    Schema,
                    ResponseSchema
                >,
            );
        },
        params<Schema extends AvirxSchema<AvirxPathParams<Path> | PromiseLike<AvirxPathParams<Path>>>>(schema: Schema) {
            return createEndpointDefinition(
                freezeEndpointState({ ...state, paramsSchema: schema }) as AvirxEndpointState<
                    Method,
                    Path,
                    Schema,
                    QuerySchema,
                    BodySchema,
                    ResponseSchema
                >,
            );
        },
        query<Schema extends AvirxSchema<AvirxQueryInput | PromiseLike<AvirxQueryInput>>>(schema: Schema) {
            return createEndpointDefinition(
                freezeEndpointState({ ...state, querySchema: schema }) as AvirxEndpointState<
                    Method,
                    Path,
                    ParamsSchema,
                    Schema,
                    BodySchema,
                    ResponseSchema
                >,
            );
        },
        returns(schema: AvirxSchema<unknown>) {
            return createEndpointDefinition(
                freezeEndpointState({ ...state, responseSchema: schema }) as AvirxEndpointState<
                    Method,
                    Path,
                    ParamsSchema,
                    QuerySchema,
                    BodySchema,
                    typeof schema
                >,
            );
        },
        state,
    };

    return Object.freeze(definition) as unknown as AvirxEndpointDefinition<
        Method,
        Path,
        ParamsSchema,
        QuerySchema,
        BodySchema,
        ResponseSchema
    >;
}
