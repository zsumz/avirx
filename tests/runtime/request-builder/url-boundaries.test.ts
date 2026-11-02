import { describe, expect, it, vi } from 'vitest';
import { avirx } from 'avirx';

describe('URL path boundaries and credentials', () => {
    it.each([
        ['/api', '/users/', '/api/users/'], ['/api/', 'users///', '/api/users///'],
        ['/api///', '/users//?q=1#top', '/api/users//'], ['/api', '/', '/api/'],
        ['/api/', '/', '/api/'], ['/api', '', '/api'], ['/api///', '', '/api///'],
        ['/api///', '?q=1', '/api///'], ['/api/', '#top', '/api/'],
        ['/api', '//', '/api//'], ['/api///', '///', '/api///'],
        ['/api', '//?q=1', '/api//'], ['/api/', '///#top', '/api///'],
        ['/api', '///?q=1#top', '/api///'], ['/', '///', '///'],
    ])('preserves route suffixes for base %s and route %s', async (base, route, pathname) => {
        const built = await avirx(`https://example.com${base}`).get(route).build();
        expect(built.url.pathname).toBe(pathname);
        expect((await avirx(`https://example.com${base}`).get(route).preview()).url).toBe(built.url.href);
    });

    it.each(['https://user:secret@example.com/api', 'https://user@example.com', 'https://:secret@example.com'])(
        'rejects base URL credentials in %s', (base) => {
            expect(() => avirx(base)).toThrow('URL credentials');
        },
    );

    it.each(['https://user:secret@other.example/users', '//user:secret@other.example/users'])(
        'rejects route URL credentials before inspection or dispatch', async (route) => {
            const fetchImpl = vi.fn<typeof fetch>();
            const request = avirx('https://example.com/api', { fetch: fetchImpl }).get(route);
            for (const inspect of [request.build, request.preview, request.curl, request.send]) {
                await expect(inspect()).rejects.toThrow('URL credentials');
            }
            expect(fetchImpl).not.toHaveBeenCalled();
        },
    );
});
