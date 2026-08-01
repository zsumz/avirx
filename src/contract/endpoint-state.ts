import type { AvirxSchema, HttpMethod } from '../types.js';

type MaybeSchema = AvirxSchema<unknown> | undefined;

export type AnyEndpointState = Readonly<{
    bodySchema: MaybeSchema;
    method: HttpMethod;
    paramsSchema: MaybeSchema;
    path: string;
    querySchema: MaybeSchema;
    responseSchema: MaybeSchema;
}>;

export function freezeEndpointState(state: AnyEndpointState): AnyEndpointState {
    return Object.freeze(state);
}
