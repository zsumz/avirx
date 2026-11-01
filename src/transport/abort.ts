import { AvirxError } from '../error/avirx-error.js';
import type { AvirxResponse } from '../types.js';

const noop = (): void => {
    return;
};

export function createAbortScope(signals: ReadonlyArray<AbortSignal | undefined>): {
    cancel(): void;
    signal?: AbortSignal;
} {
    const activeSignals = signals.filter((signal): signal is AbortSignal => signal !== undefined);
    if (activeSignals.length === 0) {
        return { cancel: noop };
    }
    if (activeSignals.length === 1) {
        const signal = activeSignals[0];
        if (!signal) {
            return { cancel: noop };
        }
        return {
            cancel: noop,
            signal,
        };
    }

    if (typeof AbortSignal.any !== 'function') {
        throw new TypeError('Combining request signals requires AbortSignal.any.');
    }

    // Native composition follows the response body lifetime without retaining manual listeners.
    return {
        cancel: noop,
        signal: AbortSignal.any(activeSignals),
    };
}

export function throwIfAborted(
    request: AvirxResponse['request'],
    signal: AbortSignal | undefined,
): void {
    if (signal?.aborted) {
        throw createAbortError(request, signal);
    }
}

export function createAbortError(
    request: AvirxResponse['request'],
    signal: AbortSignal | undefined,
): AvirxError {
    return new AvirxError('Request aborted.', {
        cause: signal?.reason,
        kind: 'aborted',
        request,
    });
}

export function createAbortReasonError(signal: AbortSignal | undefined): Error {
    return signal?.reason instanceof Error
        ? signal.reason
        : new Error('Request aborted.');
}

export function createTimeoutSignal(timeoutMs: number | undefined): {
    cancel(): void;
    signal?: AbortSignal;
} {
    if (timeoutMs === undefined) {
        return {
            cancel: noop,
        };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => {
        controller.abort();
    }, timeoutMs);

    return {
        cancel() {
            clearTimeout(timer);
        },
        signal: controller.signal,
    };
}

export async function delay(
    ms: number,
    signal?: AbortSignal,
    request?: AvirxResponse['request'],
): Promise<void> {
    if (ms <= 0) {
        return;
    }

    if (signal?.aborted) {
        throw request
            ? createAbortError(request, signal)
            : createAbortReasonError(signal);
    }

    await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
            cleanup();
            resolve();
        }, ms);
        const abort = (): void => {
            clearTimeout(timer);
            cleanup();
            reject(request ? createAbortError(request, signal) : createAbortReasonError(signal));
        };
        const cleanup = (): void => {
            signal?.removeEventListener('abort', abort);
        };
        signal?.addEventListener('abort', abort, { once: true });
    });
}
