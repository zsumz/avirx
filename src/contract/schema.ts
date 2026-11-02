import type { AvirxSchema } from '../types.js';

export function parseWithSchema<Schema extends AvirxSchema<unknown>>(
    schema: Schema,
    input: unknown,
): ReturnType<Schema['parse']> {
    return schema.parse(input) as ReturnType<Schema['parse']>;
}
