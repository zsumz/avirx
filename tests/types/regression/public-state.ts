import { avirx, type AvirxCachePolicy, type AvirxConcurrencyLimiter } from 'avirx';

const client = avirx('https://api.example.com').cache({ ttl: '1s' }).concurrency(1);
const request = client.post('/events').body(new URLSearchParams({ name: 'original' }));
const cache: AvirxCachePolicy | undefined = client.state.cache;
const limiter: AvirxConcurrencyLimiter | undefined = client.state.concurrency;
const invalidation: (() => void) | undefined = cache?.clear;
const acquisition: ((signal?: AbortSignal) => Promise<() => void>) | undefined = limiter?.acquire;
// @ts-expect-error Configuration snapshots cannot be replaced.
client.state = avirx('https://other.example.com').state;
// @ts-expect-error Public header records are readonly.
request.state.headers.accept = 'application/json';
if (cache) {
    // @ts-expect-error A new cache budget requires a derived policy.
    cache.maxEntries = 1;
}
if (limiter) {
    // @ts-expect-error Limiter configuration is readonly while the handle is live.
    limiter.max = 2;
}
void invalidation;
void acquisition;
