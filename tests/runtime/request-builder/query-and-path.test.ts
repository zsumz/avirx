import { describe, expect, it } from 'vitest';
import { avirx } from 'avirx';

describe('HTTP method builders', () => {
    it('rejects undefined request header values', () => {
        const builder = avirx('https://api.example.com').post('/events');

        expect(() => builder.headers({ 'x-request': undefined } as never)).toThrow(TypeError);
        expect(() => builder.header('x-request', undefined as never)).toThrow(TypeError);
    });

    it('forks query values without mutating previous builders', () => {
        const builder = avirx('https://api.example.com').get('/events');
        const withQuery = builder.query({ limit: 10, tag: ['a', 'b'], unused: undefined });

        expect(builder.state.query).toEqual({});
        expect(withQuery.state.query).toEqual({ limit: 10, tag: ['a', 'b'] });
        expect(Object.isFrozen(withQuery.state.query)).toBe(true);
    });

    it('copies query arrays so caller mutations cannot affect request state', () => {
        const tags = ['a', 'b'];
        const builder = avirx('https://api.example.com').get('/events').query({ tag: tags });

        tags.push('c');

        expect(builder.state.query).toEqual({ tag: ['a', 'b'] });
    });

    it('lets later query calls replace the same key while retaining other keys', () => {
        const builder = avirx('https://api.example.com')
            .get('/events')
            .query({ limit: 10, tag: ['a'] })
            .query({ tag: ['b'] });

        expect(builder.state.query).toEqual({ limit: 10, tag: ['b'] });
    });

    it('accepts URLSearchParams query input', () => {
        const params = new URLSearchParams();
        params.append('tag', 'a');
        params.append('tag', 'b');

        const builder = avirx('https://api.example.com').get('/events').query(params);

        expect(builder.state.query).toEqual({ tag: ['a', 'b'] });
    });

    it('forks path params without mutating previous builders', () => {
        const builder = avirx('https://api.example.com').get('/workspaces/{workspaceId}');
        const withPath = builder.path({ workspaceId: 'wrk_123' });

        expect(builder.state.pathParams).toEqual({});
        expect(withPath.state.pathParams).toEqual({ workspaceId: 'wrk_123' });
        expect(Object.isFrozen(withPath.state.pathParams)).toBe(true);
    });
});
