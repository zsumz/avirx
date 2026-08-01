import { normalizeHeader } from '../../transport/headers.js';
import { createResolvedAuth } from './resolved-auth.js';
import type { ResolvedAuth } from './resolved-auth.js';
import type { AvirxAuthPolicy, AvirxAuthTokenProvider } from '../../types.js';

export async function resolveAuthHeaders(
    policy: AvirxAuthPolicy | undefined,
): Promise<ResolvedAuth> {
    if (!policy) {
        return createResolvedAuth();
    }
    if (policy.kind === 'api-key-header') {
        return resolveHeaderApiKey(policy);
    }
    if (policy.kind === 'api-key-query') {
        const key = await resolveSecret(policy.key, 'API key auth function');
        return createResolvedAuth({
            query: { [policy.name]: key },
            redactedQuery: { [policy.name]: '[redacted]' },
        });
    }
    if (policy.kind === 'basic') {
        return createAuthorization(`Basic ${encodeBasicCredentials(policy.username, policy.password)}`);
    }

    const token = await resolveSecret(policy.token, 'Bearer auth token function');
    return createAuthorization(`Bearer ${token}`);
}

async function resolveHeaderApiKey(
    policy: Extract<AvirxAuthPolicy, { kind: 'api-key-header' }>,
): Promise<ResolvedAuth> {
    const name = normalizeHeaderName(policy.name);
    return createResolvedAuth({
        headers: { [name]: await resolveSecret(policy.key, 'API key auth function') },
        redactedHeaders: { [name]: '[redacted]' },
        sensitiveHeaders: [name],
    });
}

function createAuthorization(value: string): ResolvedAuth {
    return createResolvedAuth({
        headers: { authorization: value },
        redactedHeaders: { authorization: '[redacted]' },
        sensitiveHeaders: ['authorization'],
    });
}

async function resolveSecret(provider: AvirxAuthTokenProvider, label: string): Promise<string> {
    const value = await provider();
    if (typeof value !== 'string') {
        throw new TypeError(`${label} must return a string.`);
    }
    return value;
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
