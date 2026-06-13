import { normalizeDurationMs } from './duration.js';
import { isSensitiveHeader } from './redact.js';
import type { AvirxCacheInput, AvirxCacheMethod } from '../types.js';

const DEFAULT_METHODS: readonly AvirxCacheMethod[] = ['GET'];
const DEFAULT_VARY: readonly string[] = ['accept'];
const CACHEABLE_METHODS: Set<AvirxCacheMethod> = new Set(['GET', 'HEAD']);

export type NormalizedCacheOptions = Readonly<{
    maxBytes?: number;
    methods: ReadonlySet<AvirxCacheMethod>;
    ttlMs: number;
    vary: readonly string[];
}>;

export function normalizeCacheOptions(input: AvirxCacheInput): NormalizedCacheOptions {
    return Object.freeze({
        ...normalizeCacheMaxBytes(input.maxBytes),
        methods: normalizeCacheMethods(input.methods),
        ttlMs: normalizeCacheTtl(input.ttl),
        vary: normalizeVaryHeaders(input.vary),
    });
}

function normalizeCacheTtl(input: AvirxCacheInput['ttl']): number {
    const ttlMs = normalizeDurationMs(input);
    if (ttlMs <= 0) {
        throw new TypeError('Cache ttl must be greater than 0 milliseconds.');
    }

    return ttlMs;
}

function normalizeCacheMaxBytes(input: AvirxCacheInput['maxBytes']): { maxBytes?: number } {
    if (input === undefined) {
        return {};
    }

    if (!Number.isSafeInteger(input) || input < 0) {
        throw new TypeError('Cache maxBytes must be a non-negative safe integer.');
    }

    return { maxBytes: input };
}

function normalizeCacheMethods(input: AvirxCacheInput['methods']): ReadonlySet<AvirxCacheMethod> {
    const methods = input ?? DEFAULT_METHODS;
    if (methods.length === 0) {
        throw new TypeError('Cache methods must include at least one method.');
    }

    const normalized: Set<AvirxCacheMethod> = new Set();
    for (const method of methods) {
        if (!CACHEABLE_METHODS.has(method)) {
            throw new TypeError('Cache methods currently support only GET and HEAD.');
        }
        normalized.add(method);
    }

    return Object.freeze(normalized);
}

function normalizeVaryHeaders(input: AvirxCacheInput['vary']): readonly string[] {
    const vary = input ?? DEFAULT_VARY;
    const normalized: Set<string> = new Set();

    for (const name of vary) {
        const normalizedName = name.trim().toLowerCase();
        if (normalizedName.length === 0) {
            throw new TypeError('Cache vary header names cannot be empty.');
        }
        if (isSensitiveHeader(normalizedName)) {
            throw new TypeError(`Cache vary header "${name}" is sensitive.`);
        }
        normalized.add(normalizedName);
    }

    return Object.freeze([...normalized].sort());
}
