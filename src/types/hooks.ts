import type { AvirxError } from '../error/avirx-error.js';
import type { AvirxBuiltRequest } from './request.js';
import type { AvirxResponse } from './response.js';
import type { AvirxRetryEvent } from './retry.js';

export type AvirxHookEvent = 'error' | 'request' | 'response' | 'retry';

export type AvirxHookContext = Readonly<{
    error(): AvirxError | undefined;
    request(): AvirxBuiltRequest;
    response(): AvirxResponse | undefined;
    retry(): AvirxRetryEvent | undefined;
}>;

export type AvirxHookHandler = (context: AvirxHookContext) => Promise<void> | void;

export type AvirxHookRegistry = Readonly<Record<AvirxHookEvent, readonly AvirxHookHandler[]>>;
