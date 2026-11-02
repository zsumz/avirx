import type { AvirxCachePolicy, AvirxResponse } from '../../types.js';

export type CacheWrite = Readonly<{
    generation: number;
    readGeneration(): number;
}>;

const policyGenerations: WeakMap<AvirxCachePolicy, () => number> = new WeakMap();
const responseWrites: WeakMap<AvirxResponse, CacheWrite> = new WeakMap();

export function registerCachePolicy(policy: AvirxCachePolicy, readGeneration: () => number): void {
    policyGenerations.set(policy, readGeneration);
}

export function captureCacheWrite(policy: AvirxCachePolicy | undefined): CacheWrite | undefined {
    const readGeneration = policy === undefined ? undefined : policyGenerations.get(policy);
    return readGeneration === undefined ? undefined : {
        generation: readGeneration(),
        readGeneration,
    };
}

export function registerCacheResponse(response: AvirxResponse, write: CacheWrite | undefined): void {
    if (write !== undefined) responseWrites.set(response, write);
}

export function isCacheWriteCurrent(response: AvirxResponse, policy: AvirxCachePolicy | undefined): boolean {
    const write = responseWrites.get(response);
    if (write === undefined || policy === undefined) return true;
    return write.readGeneration !== policyGenerations.get(policy) || write.generation === write.readGeneration();
}
