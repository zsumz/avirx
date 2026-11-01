import { captureCacheWrite, type CacheWrite } from '../policy/cache/invalidation.js';
import type { AvirxClientState, AvirxRequestState } from '../types.js';

const requestWrites: WeakMap<AvirxRequestState, CacheWrite> = new WeakMap();

export function captureRequestCacheWrite(clientState: AvirxClientState): (state: AvirxRequestState) => void {
    const write = captureCacheWrite(clientState.cache);
    return (state) => {
        if (write !== undefined) requestWrites.set(state, write);
    };
}

export function takeRequestCacheWrite(state: AvirxRequestState): CacheWrite | undefined {
    const write = requestWrites.get(state);
    requestWrites.delete(state);
    return write;
}
