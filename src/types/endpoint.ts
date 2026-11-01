import type { AvirxBodyValue } from './body.js';
import type { HttpMethod } from './http.js';
import type {
    AvirxPathParams,
    AvirxQueryInput,
} from './request.js';
import type { AvirxSchema } from './schema.js';

export type AvirxEndpointState<
    Method extends HttpMethod = HttpMethod,
    Path extends string = string,
    ParamsSchema extends AvirxSchema<unknown> | undefined = undefined,
    QuerySchema extends AvirxSchema<unknown> | undefined = undefined,
    BodySchema extends AvirxSchema<unknown> | undefined = undefined,
    ResponseSchema extends AvirxSchema<unknown> | undefined = undefined,
> = Readonly<{
    bodySchema: BodySchema;
    method: Method;
    paramsSchema: ParamsSchema;
    path: Path;
    querySchema: QuerySchema;
    responseSchema: ResponseSchema;
}>;

export type AvirxEndpointDefinition<
    Method extends HttpMethod = HttpMethod,
    Path extends string = string,
    ParamsSchema extends AvirxSchema<unknown> | undefined = undefined,
    QuerySchema extends AvirxSchema<unknown> | undefined = undefined,
    BodySchema extends AvirxSchema<unknown> | undefined = undefined,
    ResponseSchema extends AvirxSchema<unknown> | undefined = undefined,
> = Readonly<{
    params<Schema extends AvirxSchema<AvirxPathParams<Path> | PromiseLike<AvirxPathParams<Path>>>>(
        schema: Schema,
    ): AvirxEndpointDefinition<Method, Path, Schema, QuerySchema, BodySchema, ResponseSchema>;
    query<Schema extends AvirxSchema<AvirxQueryInput | PromiseLike<AvirxQueryInput>>>(
        schema: Schema,
    ): AvirxEndpointDefinition<Method, Path, ParamsSchema, Schema, BodySchema, ResponseSchema>;
    returns<Schema extends AvirxSchema<unknown>>(
        schema: Schema,
    ): AvirxEndpointDefinition<Method, Path, ParamsSchema, QuerySchema, BodySchema, Schema>;
    state: AvirxEndpointState<Method, Path, ParamsSchema, QuerySchema, BodySchema, ResponseSchema>;
}> &
  (Method extends 'GET' | 'HEAD'
      ? Readonly<{ body?: never }>
      : Readonly<{
          body<Schema extends AvirxSchema<AvirxBodyValue | PromiseLike<AvirxBodyValue>>>(
              schema: Schema,
          ): AvirxEndpointDefinition<Method, Path, ParamsSchema, QuerySchema, Schema, ResponseSchema>;
      }>);

export type AvirxEndpointBuilder = Readonly<{
    delete<const Path extends string>(path: Path): AvirxEndpointDefinition<'DELETE', Path>;
    get<const Path extends string>(path: Path): AvirxEndpointDefinition<'GET', Path>;
    head<const Path extends string>(path: Path): AvirxEndpointDefinition<'HEAD', Path>;
    options<const Path extends string>(path: Path): AvirxEndpointDefinition<'OPTIONS', Path>;
    patch<const Path extends string>(path: Path): AvirxEndpointDefinition<'PATCH', Path>;
    post<const Path extends string>(path: Path): AvirxEndpointDefinition<'POST', Path>;
    put<const Path extends string>(path: Path): AvirxEndpointDefinition<'PUT', Path>;
}>;

export type AvirxAnyEndpointDefinition = AvirxEndpointDefinition<
    HttpMethod,
    string,
  AvirxSchema<unknown> | undefined,
  AvirxSchema<unknown> | undefined,
  AvirxSchema<unknown> | undefined,
  AvirxSchema<unknown> | undefined
>;

export type AvirxEndpointContract = Readonly<Record<string, AvirxAnyEndpointDefinition>>;
