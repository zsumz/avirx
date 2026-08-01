import { describe, expect, it } from 'vitest';
import { extractPathParamNames, interpolatePath, joinUrl } from '../../../src/transport/url.js';

describe('URL utilities', () => {
    it('joins base URL paths with relative routes', () => {
        expect(joinUrl('https://api.example.com/v1', '/users').href).toBe(
            'https://api.example.com/v1/users',
        );
        expect(joinUrl('https://api.example.com/v1/', 'users/123').href).toBe(
            'https://api.example.com/v1/users/123',
        );
    });

    it('preserves route query strings and hashes', () => {
        expect(joinUrl('https://api.example.com/v1', '/users?active=true#top').href).toBe(
            'https://api.example.com/v1/users?active=true#top',
        );
    });

    it('lets absolute routes replace the base URL', () => {
        expect(joinUrl('https://api.example.com/v1', 'https://other.example.test/users').href).toBe(
            'https://other.example.test/users',
        );
    });

    it('preserves non-HTTP absolute routes while keeping protocol-relative routes local', () => {
        expect(joinUrl('https://api.example.com/v1', 'custom+scheme:users').href).toBe(
            'custom+scheme:users',
        );
        expect(joinUrl('https://api.example.com/v1', '//other.example.test/users').href).toBe(
            'https://api.example.com/v1/users',
        );
    });

    it('extracts path param names once', () => {
        expect(extractPathParamNames('/users/{id}/teams/{id}/{teamId}')).toEqual(['id', 'teamId']);
    });

    it('interpolates and URI-encodes path params', () => {
        expect(interpolatePath('/users/{id}/files/{file}', { file: 'a/b', id: 'usr 123' })).toBe(
            '/users/usr%20123/files/a%2Fb',
        );
    });

    it('uses repeated path params consistently', () => {
        expect(interpolatePath('/compare/{id}/{id}', { id: 'same value' })).toBe(
            '/compare/same%20value/same%20value',
        );
    });

    it('rejects missing and extra path params', () => {
        expect(() => interpolatePath('/users/{id}', {})).toThrow('Missing path param "id".');
        expect(() => interpolatePath('/users/{id}', { extra: 'nope', id: 'usr_123' })).toThrow(
            'Unexpected path params: extra.',
        );
    });

    it('can join interpolated paths to base URLs', () => {
        const path = interpolatePath('/users/{id}', { id: 'usr 123' });

        expect(joinUrl('https://api.example.com/v1', path).href).toBe(
            'https://api.example.com/v1/users/usr%20123',
        );
    });
});
