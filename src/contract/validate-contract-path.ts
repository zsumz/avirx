import { extractPathParamNames } from '../transport/url.js';
import { isPlainRecord } from './plain-record.js';
import type { AvirxPrimitiveValue } from '../types.js';

export function validateContractPathParams(
    route: string,
    value: unknown,
): Readonly<Record<string, AvirxPrimitiveValue>> {
    if (!isPlainRecord(value)) {
        throw new TypeError(`Contract path params for "${route}" must be an object.`);
    }

    const expectedNames = extractPathParamNames(route);
    const providedNames = Object.keys(value);
    const missingNames = expectedNames.filter((name) => !providedNames.includes(name));
    if (missingNames.length > 0) {
        throw new TypeError(
            `Contract path params for "${route}" are missing: ${missingNames.join(', ')}.`,
        );
    }

    const extraNames = providedNames.filter((name) => !expectedNames.includes(name));
    if (extraNames.length > 0) {
        throw new TypeError(
            `Unexpected contract path params for "${route}": ${extraNames.join(', ')}.`,
        );
    }

    const params: Record<string, AvirxPrimitiveValue> = {};
    for (const [name, paramValue] of Object.entries(value)) {
        if (!isPrimitiveValue(paramValue)) {
            throw new TypeError(
                `Contract path param "${name}" must be a string, number, or boolean.`,
            );
        }
        Object.defineProperty(params, name, { enumerable: true, value: paramValue });
    }

    return Object.freeze(params);
}

function isPrimitiveValue(value: unknown): value is AvirxPrimitiveValue {
    return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}
