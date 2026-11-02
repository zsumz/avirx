import { describe, expect, it } from 'vitest';
import { avirx } from 'avirx';
import { httpText, startHttpTestServer } from '../../helpers/http-server.js';

describe('real HTTP path boundaries', () => {
    it('dispatches route trailing separators and preserves the empty base path', async () => {
        const server = await startHttpTestServer();
        try {
            const cases = [
                ['/users/', '/api/users/', ''], ['users///?q=1#top', '/api/users///', '?q=1'],
                ['/', '/api/', ''], ['', '/api///', ''], ['?q=1', '/api///', '?q=1'],
                ['//', '/api//', ''], ['///', '/api///', ''], ['//?q=1', '/api//', '?q=1'],
                ['///#top', '/api///', ''], ['///?q=1#top', '/api///', '?q=1'],
            ] as const;
            for (const [, pathname] of cases) server.route('GET', pathname, () => httpText('ok'));
            for (const [route, pathname, search] of cases) {
                const request = avirx(`${server.origin}/api///`).get(route);
                const built = await request.build();
                expect(built.url.pathname).toBe(pathname);
                expect(await request.curl()).toContain(built.url.href);
                await request.text();
                expect(server.requests.at(-1)?.url.pathname).toBe(pathname);
                expect(server.requests.at(-1)?.url.search).toBe(search);
            }
        } finally {
            await server.close();
        }
    });
});
