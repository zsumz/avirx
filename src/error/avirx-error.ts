import type { AvirxBuiltRequest, AvirxResponse } from '../types.js';

export type AvirxErrorKind = 'aborted' | 'timeout' | 'network' | 'http' | 'decode' | 'validation'
    | 'queue-full' | 'queue-timeout' | 'unknown';

export class AvirxError<E = unknown> extends Error {
    public readonly data?: E;
    public readonly kind: AvirxErrorKind;
    public readonly request: AvirxBuiltRequest;
    public readonly response?: AvirxResponse;
    public readonly status?: number;

    constructor(
        message: string,
        options: {
            cause?: unknown;
            data?: E;
            kind?: AvirxErrorKind;
            request: AvirxBuiltRequest;
            response?: AvirxResponse;
            status?: number;
        },
    ) {
        super(message, { cause: options.cause });
        this.name = 'AvirxError';
        this.kind = options.kind ?? 'unknown';
        this.request = options.request;
        if ('data' in options) {
            this.data = options.data;
        }
        if ('response' in options) {
            this.response = options.response;
        }
        if ('status' in options) {
            this.status = options.status;
        }
    }
}

export function isAvirxError(error: unknown): error is AvirxError {
    return error instanceof AvirxError;
}
