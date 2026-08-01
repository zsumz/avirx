import type { ApiError, Book } from './production-types.js';

export const BookSchema = {
    parse(input: unknown): Book {
        const value = assertRecord(input);
        return {
            id: assertString(value.id, 'book.id'),
            title: assertString(value.title, 'book.title'),
        };
    },
};

export const ApiErrorSchema = {
    parse(input: unknown): ApiError {
        const value = assertRecord(input);
        return {
            code: assertString(value.code, 'error.code'),
            message: assertString(value.message, 'error.message'),
        };
    },
};

export const ParamsSchema = {
    parse(input: unknown): { id: string } {
        const value = assertRecord(input);
        return { id: assertString(value.id, 'params.id') };
    },
};

function assertRecord(input: unknown): Record<string, unknown> {
    if (typeof input !== 'object' || input === null) {
        throw new TypeError('Expected an object.');
    }
    return input as Record<string, unknown>;
}

function assertString(input: unknown, name: string): string {
    if (typeof input !== 'string') {
        throw new TypeError(`Expected ${name} to be a string.`);
    }
    return input;
}
