import { describe, expect, it, vi } from 'vitest';
import { avirx } from 'avirx';

describe('placeholder grammar', () => {
    it.each(['a/b', 'a\\b', 'a?b', 'a#b', 'a b', 'a\u00a0b', 'a{b', 'a}b', ''])(
        'rejects unsafe placeholder name %j before dispatch', async (name) => {
            const fetchImpl = vi.fn<typeof fetch>();
            const request = avirx('https://example.com/api', { fetch: fetchImpl })
                .delete(`/users/{${name}}/files/{id}` as '/users/{key}/files/{id}')
                .path({ [name]: 'value', id: '..' } as never);
            for (const inspect of [request.build, request.preview, request.curl, request.send]) {
                await expect(inspect()).rejects.toThrow('placeholder');
            }
            expect(fetchImpl).not.toHaveBeenCalled();
        },
    );

    it.each(['/users/{id', '/users/id}', '/users/{{id}}'])(
        'rejects malformed braces in %s', async (route) => {
            await expect(avirx('https://example.com').get(route).build()).rejects.toThrow('placeholder');
        },
    );

    it.each(['v1.id', 'urn:id', '用户', 'x-y', 'constructor', '__proto__'])(
        'preserves supported placeholder name %s', async (name) => {
            const built = await avirx('https://example.com').get(`/{${name}}` as '/{id}')
                .path({ [name]: 'a/b' } as never).build();
            expect(built.url.pathname).toBe('/a%2Fb');
        },
    );

    it('supports explicitly encoded literal braces', async () => {
        expect((await avirx('https://example.com').get('/%7Bname%7D').build()).url.pathname).toBe('/%7Bname%7D');
    });
});
