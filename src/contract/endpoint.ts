import type {
    AvirxBodyValue,
    AvirxEndpointBuilder,
    AvirxEndpointDefinition,
    AvirxEndpointState,
    AvirxPathParams,
    AvirxQueryInput,
    AvirxSchema,
    HttpMethod,
} from '../types.js';

type MaybeSchema = AvirxSchema<unknown> | undefined;
type AnyEndpointState = Readonly<{
    bodySchema: MaybeSchema;
    method: HttpMethod;
    paramsSchema: MaybeSchema;
    path: string;
    querySchema: MaybeSchema;
    responseSchema: MaybeSchema;
}>;

export const endpoint: AvirxEndpointBuilder = Object.freeze({
    delete(path) {
        return createEndpoint('DELETE', path);
    },
    get(path) {
        return createEndpoint('GET', path);
    },
    head(path) {
        return createEndpoint('HEAD', path);
    },
    options(path) {
        return createEndpoint('OPTIONS', path);
    },
    patch(path) {
        return createEndpoint('PATCH', path);
    },
    post(path) {
        return createEndpoint('POST', path);
    },
    put(path) {
        return createEndpoint('PUT', path);
    },
});

function createEndpoint<Method extends HttpMethod, const Path extends string>(
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

function createEndpointDefinition<
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
        body<Schema extends AvirxSchema<AvirxBodyValue>>(schema: Schema) {
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
        params<Schema extends AvirxSchema<AvirxPathParams<Path>>>(schema: Schema) {
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
        query<Schema extends AvirxSchema<AvirxQueryInput>>(schema: Schema) {
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

function freezeEndpointState(state: AnyEndpointState): AnyEndpointState {
    return Object.freeze(state);
}
