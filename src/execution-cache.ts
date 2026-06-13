import { isCachedResponse } from './internals/cache.js';
import type { AvirxClientState, AvirxResponse } from './types.js';

export async function writeCacheResponse(
    clientState: AvirxClientState,
    response: AvirxResponse,
): Promise<void> {
    if (isCachedResponse(response)) {
        return;
    }

    try {
        await clientState.cache?.set(response.request, response);
    } catch {
    // Cache writes are best-effort; execution results should not depend on them.
    }
}
