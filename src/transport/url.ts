import type { AvirxPrimitiveValue } from '../types.js';

export function joinUrl(baseUrl: string | URL, route: string): URL {
    const base = new URL(baseUrl);

    if (isAbsoluteUrl(route)) {
        return new URL(route);
    }

    const routeUrl = new URL(route, 'http://avirx.local');
    const basePath = trimSlashes(base.pathname);
    const routePath = trimSlashes(routeUrl.pathname);
    const joinedPath = [basePath, routePath].filter(Boolean).join('/');

    const url = new URL(base.href);
    url.pathname = joinedPath ? `/${joinedPath}` : '/';
    url.search = routeUrl.search;
    url.hash = routeUrl.hash;

    return url;
}

export function interpolatePath(
    route: string,
    params: Readonly<Record<string, AvirxPrimitiveValue>>,
): string {
    validateRouteTemplate(route);
    const expectedNames = new Set(extractPathParamNames(route));
    const providedNames = Object.keys(params);
    const extraNames = providedNames.filter((name) => !expectedNames.has(name));

    if (extraNames.length > 0) {
        throw new TypeError(`Unexpected path params: ${extraNames.join(', ')}.`);
    }

    const interpolated = route.replace(/\{([^}]+)\}/gu, (_match, name: string) => {
        const value = params[name];
        if (!Object.hasOwn(params, name) || value === undefined) {
            throw new TypeError(`Missing path param "${name}".`);
        }

        return encodeURIComponent(String(value));
    });
    rejectInterpolatedDotSegments(route, interpolated);
    return interpolated;
}

export function extractPathParamNames(route: string): readonly string[] {
    const names: string[] = [];

    for (const match of route.matchAll(/\{([^}]+)\}/gu)) {
        const name = match[1];
        if (name && !names.includes(name)) {
            names.push(name);
        }
    }

    return Object.freeze(names);
}

function isAbsoluteUrl(value: string): boolean {
    return /^[a-zA-Z][a-zA-Z\d+.-]*:/u.test(value);
}

function trimSlashes(value: string): string {
    return value.replace(/^\/+|\/+$/gu, '');
}

function validateRouteTemplate(route: string): void {
    if (route.startsWith(' ') || route.endsWith(' ')
        || Array.from(route).some((character) => character.charCodeAt(0) < 32)) {
        throw new TypeError('Route templates must not contain control characters or leading/trailing spaces.');
    }
}

function rejectInterpolatedDotSegments(route: string, interpolated: string): void {
    const segments = (route.split(/[?#]/u)[0] ?? '').replaceAll('\\', '/').split('/');
    const resolved = (interpolated.split(/[?#]/u)[0] ?? '').replaceAll('\\', '/').split('/');
    for (const [index, segment] of segments.entries()) {
        const decodedDots = resolved[index]?.replace(/%2e/giu, '.');
        if (segment.includes('{') && (decodedDots === '.' || decodedDots === '..')) {
            throw new TypeError('Path params must not produce dot path segments.');
        }
    }
}
