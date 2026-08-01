import type { AvirxHeaders } from '../../types.js';

export type ResolvedAuth = Readonly<{
    headers: AvirxHeaders;
    query: Readonly<Record<string, string>>;
    redactedQuery: Readonly<Record<string, string>>;
    redactedHeaders: AvirxHeaders;
    sensitiveHeaders: readonly string[];
}>;

export function createResolvedAuth(auth: Partial<ResolvedAuth> = {}): ResolvedAuth {
    return Object.freeze({
        headers: Object.freeze({ ...auth.headers ?? {} }),
        query: Object.freeze({ ...auth.query ?? {} }),
        redactedQuery: Object.freeze({ ...auth.redactedQuery ?? {} }),
        redactedHeaders: Object.freeze({ ...auth.redactedHeaders ?? {} }),
        sensitiveHeaders: Object.freeze([...auth.sensitiveHeaders ?? []]),
    });
}
