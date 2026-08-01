import type {
    AvirxHookContext,
    AvirxHookEvent,
    AvirxHookHandler,
    AvirxHookRegistry,
} from '../../types.js';

const HOOK_EVENTS = ['error', 'request', 'response', 'retry'] as const;

export function appendHook(
    hooks: AvirxHookRegistry | undefined,
    event: AvirxHookEvent,
    handler: AvirxHookHandler,
): AvirxHookRegistry {
    if (typeof handler !== 'function') {
        throw new TypeError('Hook handler must be a function.');
    }

    const next = createHookRegistry(hooks);
    next[event] = Object.freeze([...next[event], handler]);

    return freezeHookRegistry(next);
}

export function mergeHooks(
    clientHooks: AvirxHookRegistry | undefined,
    requestHooks: AvirxHookRegistry | undefined,
): AvirxHookRegistry {
    const merged = createHookRegistry();

    for (const event of HOOK_EVENTS) {
        merged[event] = Object.freeze([
            ...clientHooks?.[event] ?? [],
            ...requestHooks?.[event] ?? [],
        ]);
    }

    return freezeHookRegistry(merged);
}

export async function runHooks(
    hooks: AvirxHookRegistry,
    event: AvirxHookEvent,
    context: AvirxHookContext,
): Promise<void> {
    for (const hook of hooks[event]) {
        await hook(context);
    }
}

function createHookRegistry(source?: AvirxHookRegistry): Record<AvirxHookEvent, readonly AvirxHookHandler[]> {
    return {
        error: source?.error ?? Object.freeze([]),
        request: source?.request ?? Object.freeze([]),
        response: source?.response ?? Object.freeze([]),
        retry: source?.retry ?? Object.freeze([]),
    };
}

function freezeHookRegistry(
    hooks: Record<AvirxHookEvent, readonly AvirxHookHandler[]>,
): AvirxHookRegistry {
    return Object.freeze({
        error: hooks.error,
        request: hooks.request,
        response: hooks.response,
        retry: hooks.retry,
    });
}
