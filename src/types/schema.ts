export interface AvirxSchema<T, Input = unknown> {
    parse(input: Input): T;
}

export type AvirxInferSchema<Schema extends AvirxSchema<unknown>> =
    Awaited<ReturnType<Schema['parse']>>;
