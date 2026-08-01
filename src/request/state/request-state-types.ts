import type {
    AvirxAuthPolicy,
    AvirxBodyMetadata,
    AvirxBodyValue,
    AvirxHeaders,
    AvirxHookRegistry,
    AvirxPrimitiveValue,
    AvirxQueryValue,
    AvirxRequestState,
    AvirxRetryMetadata,
    AvirxSchema,
    HttpMethod,
} from '../../types.js';

export interface MutableRequestState {
    auth?: AvirxAuthPolicy;
    body?: AvirxBodyValue;
    bodyMetadata?: AvirxBodyMetadata;
    errorSchema?: AvirxSchema<unknown>;
    expectedStatuses: ReadonlySet<number>;
    headers: AvirxHeaders;
    hooks?: AvirxHookRegistry;
    method: HttpMethod;
    pathParams: Readonly<Record<string, AvirxPrimitiveValue>>;
    query: Readonly<Record<string, AvirxQueryValue>>;
    retry?: AvirxRetryMetadata;
    route: string;
    signal?: AbortSignal;
    timeoutMs?: false | number;
}

export type RequestStatePatch = Partial<Omit<
    MutableRequestState,
    'expectedStatuses' | 'method' | 'pathParams' | 'query' | 'route'
> & {
    expectedStatuses: Iterable<number>;
    pathParams: MutableRequestState['pathParams'];
    query: MutableRequestState['query'];
}>;

export type PublicRequestStateSnapshot = {
    -readonly [Key in keyof AvirxRequestState]?: AvirxRequestState[Key];
};
