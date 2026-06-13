export interface AvirxSchema<T> {
    parse(input: unknown): T;
}

export type AvirxInferSchema<Schema extends AvirxSchema<unknown>> =
    Schema extends AvirxSchema<infer Output> ? Output : never;
