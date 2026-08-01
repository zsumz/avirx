import type { AvirxInferSchema, AvirxSchema } from '../types.js';

export function parseWithSchema<Schema extends AvirxSchema<unknown>>(
    schema: Schema,
    input: unknown,
): AvirxInferSchema<Schema> {
    return schema.parse(input) as AvirxInferSchema<Schema>;
}
