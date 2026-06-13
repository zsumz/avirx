import type { AvirxAuthPolicy, AvirxAuthTokenProvider, AvirxHeaders } from '../types.js';
import { normalizeHeader } from './headers.js';

export type ResolvedAuth = Readonly<{
    headers: AvirxHeaders;
    query: Readonly<Record<string, string>>;
    redactedQuery: Readonly<Record<string, string>>;
    redactedHeaders: AvirxHeaders;
    sensitiveHeaders: readonly string[];
}>;

export function createApiKeyHeaderAuth(
    name: string,
    key: AvirxAuthTokenProvider,
): AvirxAuthPolicy {
    if (typeof key !== 'function') {
        throw new TypeError('API key auth value must be provided by a function.');
    }

    return Object.freeze({
        kind: 'api-key-header',
        key,
        name: normalizeAuthName(name, 'API key header name'),
    });
}

export function createApiKeyQueryAuth(
    name: string,
    key: AvirxAuthTokenProvider,
): AvirxAuthPolicy {
    if (typeof key !== 'function') {
        throw new TypeError('API key auth value must be provided by a function.');
    }

    return Object.freeze({
        kind: 'api-key-query',
        key,
        name: normalizeAuthName(name, 'API key query name'),
    });
}

export function createBasicAuth(username: string, password: string): AvirxAuthPolicy {
    if (typeof username !== 'string' || typeof password !== 'string') {
        throw new TypeError('Basic auth username and password must be strings.');
    }

    return Object.freeze({
        kind: 'basic',
        password,
        username,
    });
}

export function createBearerAuth(token: AvirxAuthTokenProvider): AvirxAuthPolicy {
    if (typeof token !== 'function') {
        throw new TypeError('Bearer auth token must be provided by a function.');
    }

    return Object.freeze({
        kind: 'bearer',
        token,
    });
}

export async function resolveAuthHeaders(
    policy: AvirxAuthPolicy | undefined,
): Promise<ResolvedAuth> {
    if (!policy) {
        return createResolvedAuth();
    }

    if (policy.kind === 'api-key-header') {
        const normalizedName = normalizeHeaderName(policy.name);
        return createResolvedAuth({
            headers: {
                [normalizedName]: await resolveSecret(policy.key, 'API key auth function'),
            },
            redactedHeaders: {
                [normalizedName]: '[redacted]',
            },
            sensitiveHeaders: [normalizedName],
        });
    }

    if (policy.kind === 'api-key-query') {
        const key = await resolveSecret(policy.key, 'API key auth function');
        return createResolvedAuth({
            query: {
                [policy.name]: key,
            },
            redactedQuery: {
                [policy.name]: '[redacted]',
            },
        });
    }

    if (policy.kind === 'basic') {
        return createResolvedAuth({
            headers: {
                authorization: `Basic ${encodeBasicCredentials(policy.username, policy.password)}`,
            },
            redactedHeaders: {
                authorization: '[redacted]',
            },
            sensitiveHeaders: ['authorization'],
        });
    }

    return createResolvedAuth({
        headers: {
            authorization: `Bearer ${await resolveSecret(policy.token, 'Bearer auth token function')}`,
        },
        redactedHeaders: {
            authorization: '[redacted]',
        },
        sensitiveHeaders: ['authorization'],
    });
}

function createResolvedAuth(
    auth: Partial<ResolvedAuth> = {},
): ResolvedAuth {
    return Object.freeze({
        headers: Object.freeze({ ...auth.headers ?? {} }),
        query: Object.freeze({ ...auth.query ?? {} }),
        redactedQuery: Object.freeze({ ...auth.redactedQuery ?? {} }),
        redactedHeaders: Object.freeze({ ...auth.redactedHeaders ?? {} }),
        sensitiveHeaders: Object.freeze([...auth.sensitiveHeaders ?? []]),
    });
}

async function resolveSecret(provider: AvirxAuthTokenProvider, label: string): Promise<string> {
    const value = await provider();
    if (typeof value !== 'string') {
        throw new TypeError(`${label} must return a string.`);
    }

    return value;
}

function normalizeAuthName(name: string, label: string): string {
    const normalized = name.trim();
    if (!normalized) {
        throw new TypeError(`${label} must not be empty.`);
    }

    return normalized;
}

function normalizeHeaderName(name: string): string {
    const [normalizedName] = Object.keys(normalizeHeader(name, ''));
    if (normalizedName === undefined) {
        throw new TypeError('API key header name must not be empty.');
    }

    return normalizedName;
}

function encodeBasicCredentials(username: string, password: string): string {
    const bytes = new TextEncoder().encode(`${username}:${password}`);
    let binary = '';

    for (const byte of bytes) {
        binary += String.fromCharCode(byte);
    }

    return btoa(binary);
}
