import type { AvirxAuthPolicy, AvirxAuthTokenProvider } from '../../types.js';

export function createApiKeyHeaderAuth(
    name: string,
    key: AvirxAuthTokenProvider,
): AvirxAuthPolicy {
    return Object.freeze({
        kind: 'api-key-header',
        key: requireTokenProvider(key, 'API key auth value'),
        name: normalizeAuthName(name, 'API key header name'),
    });
}

export function createApiKeyQueryAuth(
    name: string,
    key: AvirxAuthTokenProvider,
): AvirxAuthPolicy {
    return Object.freeze({
        kind: 'api-key-query',
        key: requireTokenProvider(key, 'API key auth value'),
        name: normalizeAuthName(name, 'API key query name'),
    });
}

export function createBasicAuth(username: string, password: string): AvirxAuthPolicy {
    if (typeof username !== 'string' || typeof password !== 'string') {
        throw new TypeError('Basic auth username and password must be strings.');
    }

    return Object.freeze({ kind: 'basic', password, username });
}

export function createBearerAuth(token: AvirxAuthTokenProvider): AvirxAuthPolicy {
    return Object.freeze({
        kind: 'bearer',
        token: requireTokenProvider(token, 'Bearer auth token'),
    });
}

function requireTokenProvider(
    provider: AvirxAuthTokenProvider,
    label: string,
): AvirxAuthTokenProvider {
    if (typeof provider !== 'function') {
        throw new TypeError(`${label} must be provided by a function.`);
    }
    return provider;
}

function normalizeAuthName(name: string, label: string): string {
    const normalized = name.trim();
    if (!normalized) {
        throw new TypeError(`${label} must not be empty.`);
    }
    return normalized;
}
