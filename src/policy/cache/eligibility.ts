import type { AvirxHeaders, AvirxResponse } from '../../types.js';

export function forbidsCache(headers: AvirxHeaders): boolean {
    const directives = cacheDirectives(headers['cache-control']);
    return directives === undefined || directives.has('no-store') || directives.has('no-cache');
}

export function isPublicCacheResponse(response: AvirxResponse, vary: readonly string[]): boolean {
    const directives = cacheDirectives(response.headers['cache-control']);
    if (!response.ok || response.status === 206 || response.headers['content-range'] !== undefined
        || !directives?.has('public') || directives.has('private') || forbidsCache(response.headers)
        || response.headers['set-cookie'] !== undefined) {
        return false;
    }

    return (response.headers.vary ?? '').split(',').every((name) => {
        const header = name.trim().toLowerCase();
        return header === '' || header !== '*' && vary.includes(header);
    });
}

function cacheDirectives(value: string | undefined): ReadonlySet<string> | undefined {
    const directives: Set<string> = new Set();
    let quoted = false;
    let escaped = false;
    let part = '';
    for (const character of value ?? '') {
        if (escaped) escaped = false;
        else if (quoted && character === '\\') escaped = true;
        else if (character === '"') quoted = !quoted;

        if (character === ',' && !quoted) {
            addDirective(directives, part);
            part = '';
        } else {
            part += character;
        }
    }
    if (quoted) return undefined;
    addDirective(directives, part);
    return directives;
}

function addDirective(directives: Set<string>, part: string): void {
    const name = part.split('=')[0]?.trim().toLowerCase() ?? '';
    if (name !== 'public' || !part.includes('=')) directives.add(name);
}
