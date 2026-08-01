import type {
    AvirxBodyValue,
    AvirxBuiltRequest,
    AvirxHeaders,
    AvirxQueryInput,
} from '../types.js';

export type BuildRequestAuth = Readonly<{
    headers?: AvirxHeaders;
    query?: AvirxQueryInput;
    redactedHeaders?: AvirxHeaders;
    redactedQuery?: AvirxQueryInput;
    sensitiveHeaders?: readonly string[];
}>;

export interface MutableBuiltRequest {
    body?: AvirxBodyValue;
    bodyMetadata: AvirxBuiltRequest['bodyMetadata'];
    headers: AvirxHeaders;
    method: AvirxBuiltRequest['method'];
    redactedHeaders: AvirxHeaders;
    redactedUrl: URL;
    retry?: NonNullable<AvirxBuiltRequest['retry']>;
    sensitiveHeaders: readonly string[];
    timeoutMs?: number;
    url: URL;
}
