import { describe, expect, it, vi } from 'vitest';
import { avirx } from 'avirx';

describe('route safety', () => {
    it.each(['.', '..'] as const)('rejects a %s identifier before dispatch', async (id) => {
        const fetchImpl = vi.fn<typeof fetch>();
        const request = avirx('https://example.com/api', { fetch: fetchImpl })
            .delete('/users/{id}').path({ id });
        await expect(request.build()).rejects.toThrow('dot path segments');
        await expect(request.send()).rejects.toThrow('dot path segments');
        expect(fetchImpl).not.toHaveBeenCalled();
    });

    it.each([
        ' /users/{id}',
        '/users/{id} ',
        ' https://example.com/users/{id}',
        'https://example.com/users/{id} ',
        'https://example.com/users/\t{id}',
        ...Array.from({ length: 32 }, (_, code) => `/users/${String.fromCharCode(code)}{id}` as const),
    ] as const)('rejects unsafe static route whitespace and controls in %j', async (route) => {
        const fetchImpl = vi.fn<typeof fetch>();
        const request = avirx('https://example.com/api', { fetch: fetchImpl })
            .delete(route).path({ id: '..' });
        for (const inspect of [request.build, request.preview, request.curl, request.send]) {
            await expect(inspect()).rejects.toThrow('Route templates');
        }
        expect(fetchImpl).not.toHaveBeenCalled();
    });

    it('preserves interior spaces and encoded whitespace without changing the target', async () => {
        const api = avirx('https://example.com/api');
        const spaced = await api.get('/user groups/{id}').path({ id: 'a b' }).build();
        expect(spaced.url.pathname).toBe('/api/user%20groups/a%20b');
        const encoded = await api.get('/users/%09{id}').path({ id: '..' }).build();
        expect(encoded.url.pathname).toBe('/api/users/%09..');
        const parameter = await api.get('/users/{id}').path({ id: '\t..' }).build();
        expect(parameter.url.pathname).toBe('/api/users/%09..');
    });

    it('rejects dot segments formed by embedded and adjacent placeholders', async () => {
        const api = avirx('https://example.com/api');
        await expect(api.get('/users/.{id}').path({ id: '.' }).build())
            .rejects.toThrow('dot path segments');
        await expect(api.get('/users/{left}{right}').path({ left: '.', right: '.' }).build())
            .rejects.toThrow('dot path segments');
        await expect(api.get('/users\\{id}').path({ id: '..' }).build())
            .rejects.toThrow('dot path segments');
        expect((await api.get('/users/{id}').path({ id: 'a.b' }).build()).url.pathname)
            .toBe('/api/users/a.b');
        expect((await api.get('/users/{id}').path({ id: '%2e%2e' }).build()).url.pathname)
            .toBe('/api/users/%252e%252e');
    });

    it.each(['/users/%2e{id}', '/users/{id}%2E', '/users/%2e%2e{id}'] as const)(
        'rejects encoded dot segments assembled by %s',
        async (route) => {
            const api = avirx('https://example.com/api');
            const id = route.includes('%2e%2e') ? '' : '.';
            await expect(api.get(route).path({ id }).build()).rejects.toThrow('dot path segments');
            expect((await api.get(route).path({ id: 'safe' }).build()).url.pathname)
                .toContain('safe');
        },
    );

    it.each(['constructor', '__proto__', 'toString'] as const)(
        'rejects a missing own %s parameter and preserves an explicit value',
        async (name) => {
            const api = avirx('https://example.com');
            const request = api.get(`/{${name}}`);
            await expect(request.build()).rejects.toThrow('Missing path param');
            const built = await request.path({ [name]: 'expected' } as never).build();
            expect(built.url.pathname).toBe('/expected');
        },
    );
});
