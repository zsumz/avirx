import { describe, expect, it } from 'vitest';

import { endpoint } from 'avirx';

const ParamsSchema = Object.freeze({
    parse(input: unknown): { id: string } {
        return input as { id: string };
    },
});

const QuerySchema = Object.freeze({
    parse(input: unknown): { include?: readonly string[] } {
        return input as { include?: readonly string[] };
    },
});

const BodySchema = Object.freeze({
    parse(input: unknown): { title: string } {
        return input as { title: string };
    },
});

const BookSchema = Object.freeze({
    parse(input: unknown): { id: string; title: string } {
        return input as { id: string; title: string };
    },
});

describe('endpoint builder', () => {
    it('stores method, path, schemas, and response schema', () => {
        const definition = endpoint
            .get('/books/{id}')
            .params(ParamsSchema)
            .query(QuerySchema)
            .returns(BookSchema);

        expect(definition.state).toEqual({
            bodySchema: undefined,
            method: 'GET',
            paramsSchema: ParamsSchema,
            path: '/books/{id}',
            querySchema: QuerySchema,
            responseSchema: BookSchema,
        });
    });

    it('builds immutable endpoint values', () => {
        const base = endpoint.post('/books');
        const withBody = base.body(BodySchema);
        const withResponse = withBody.returns(BookSchema);

        expect(base).not.toBe(withBody);
        expect(withBody).not.toBe(withResponse);
        expect(base.state).toEqual({
            bodySchema: undefined,
            method: 'POST',
            paramsSchema: undefined,
            path: '/books',
            querySchema: undefined,
            responseSchema: undefined,
        });
        expect(withBody.state).toEqual({
            bodySchema: BodySchema,
            method: 'POST',
            paramsSchema: undefined,
            path: '/books',
            querySchema: undefined,
            responseSchema: undefined,
        });
        expect(withResponse.state).toEqual({
            bodySchema: BodySchema,
            method: 'POST',
            paramsSchema: undefined,
            path: '/books',
            querySchema: undefined,
            responseSchema: BookSchema,
        });
        expect(Object.isFrozen(base)).toBe(true);
        expect(Object.isFrozen(base.state)).toBe(true);
        expect(Object.isFrozen(withBody)).toBe(true);
        expect(Object.isFrozen(withBody.state)).toBe(true);
    });

    it('supports each MVP HTTP method', () => {
        expect(endpoint.delete('/items').state.method).toBe('DELETE');
        expect(endpoint.get('/items').state.method).toBe('GET');
        expect(endpoint.head('/items').state.method).toBe('HEAD');
        expect(endpoint.options('/items').state.method).toBe('OPTIONS');
        expect(endpoint.patch('/items').state.method).toBe('PATCH');
        expect(endpoint.post('/items').state.method).toBe('POST');
        expect(endpoint.put('/items').state.method).toBe('PUT');
    });

    it('rejects body schemas for GET and HEAD endpoints at runtime', () => {
        const getEndpoint = endpoint.get('/books');
        const headEndpoint = endpoint.head('/books');

        expect(() => (getEndpoint as never as { body(schema: unknown): unknown }).body(BodySchema)).toThrow(
            'GET endpoint contracts cannot define a body schema.',
        );
        expect(() => (headEndpoint as never as { body(schema: unknown): unknown }).body(BodySchema)).toThrow(
            'HEAD endpoint contracts cannot define a body schema.',
        );
    });
});
