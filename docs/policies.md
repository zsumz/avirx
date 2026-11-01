# Policies

Policies are immutable configuration values. Calling a policy method returns a derived client or
request builder; it does not mutate the value that came before it.

Client headers, timeout, retry, auth, hooks, cache, concurrency, and rate limiting flow into derived
requests. Request-level headers are merged last. Request-level timeout, retry, and auth replace the
corresponding client setting for that request.

## Authentication

```ts
const api = avirx(baseUrl)
    .auth.bearer(() => token)
    .auth.apiKey('x-api-key', () => key);
```

The last auth policy in a chain wins. A request-level policy overrides the client policy. Avirx
supports bearer tokens, basic credentials, header API keys, and query API keys. Token and API-key
providers may be synchronous or asynchronous, are evaluated for every attempt, and must return a
string.

Raw auth policy values are kept outside public state. Built requests still contain the real headers
and URL needed by `fetch`, alongside redacted forms used by preview and cURL output. Authentication
also makes the request ineligible for the built-in cache.

## Retry

```ts
const api = avirx(baseUrl).retry({
    attempts: 3,
    on: [408, 429, 500, 502, 503, 504],
});
```

A number is shorthand for `{ attempts: number }`. Attempts must be an integer from 0 through 10.
The default status list is 408, 429, 500, 502, 503, and 504.

Retries are intentionally conservative:

- Only `DELETE`, `GET`, `HEAD`, `OPTIONS`, and `PUT` retry.
- `POST` and `PATCH` do not retry, even when the status matches.
- `FormData` and `ReadableStream` bodies do not retry.
- An expected status never retries.
- `Retry-After` seconds or HTTP dates are honored up to 60 seconds.
- Without `Retry-After`, delays are 10, 20, 40 milliseconds, and so on.

Each attempt rebuilds the request, resolves auth again, acquires policy budgets, and gets a fresh
timeout. Retry metadata is available from response timing and retry hook context.

## Cache

```ts
const api = avirx(baseUrl).cache({
    ttl: '30s',
    maxBytes: 1_000_000,
    vary: ['accept', 'accept-language'],
});
```

The cache is a bounded, in-memory TTL store for **explicitly public reference data**. A response must
include `Cache-Control: public`; opting a client into caching never overrides a server's privacy
instructions. Responses with `private`, `no-store`, `no-cache`, visible `Set-Cookie`, `Vary: *`, partial content,
or a `Vary` field absent from configured `vary` are ineligible. Requests with `no-store`/`no-cache`, an
auth policy, or sensitive headers bypass it. This covers ambient browser cookie sessions by requiring
the server to explicitly classify reusable data as public. A server must not mark user-specific data
public.

Only unfiltered native response types `basic` and `default` are eligible. Browser `cors` responses
always bypass storage, including responses that expose `Vary`: CORS filtering can hide eligibility
metadata, so Avirx does not infer that missing headers were absent on the wire. Same-origin browser
responses and Node fetch remain eligible when the other public-data rules pass. A custom fetch must
preserve accurate, unfiltered response metadata to use this cache safely.

Configured vary headers distinguish a missing field from an explicitly empty value. Both header
presence and value participate in the key.

It defaults to `GET`, varies on `accept`, and allows explicit `HEAD`. This is a TTL memoizer;
it does not perform HTTP revalidation, combine ranges, or infer server freshness. `ttl` controls
freshness within the eligible public-data boundary.

Default limits are **128 entries** and **16 MiB total body bytes**. Set `maxEntries` and
`maxTotalBytes` to change these finite limits. `maxBytes` optionally imposes a smaller per-response
limit and requires valid `Content-Length` metadata. Body reads stop at the effective size limit;
expired entries are reclaimed during normal access and writes, and live entries use least-recently-used
eviction. Expired data can remain idle until the next cache operation, but storage stays bounded.

Call `api.state.cache?.clear()` to invalidate all entries, including writes already in flight.
Derived clients share the same policy store until a new `.cache(...)` policy is installed.

Cache lookup happens before admission and hooks. Hits consume no network budgets or hooks.
Buffered terminals write only after successful parsing and awaited validation. `.send()` can read
an existing hit but never buffers a network response for caching, so streaming remains immediate.
A hit returns fresh body bytes and zero-duration timing. `AvirxResponse.url` preserves the original
final URL; its native `Response` is synthetic and cannot preserve native redirect/type metadata.

## Concurrency

```ts
const api = avirx(baseUrl).concurrency(8);
```

The limit must be a positive integer. Requests beyond the active limit wait in FIFO order. A slot is
released after fetch resolves or rejects, before terminal parsing begins. Aborted queued requests are
removed without consuming a slot.

## Rate limiting

```ts
const api = avirx(baseUrl).rateLimit({
    requests: 100,
    per: '1s',
    queue: 500,
    queueTimeout: '5s',
});
```

The limiter uses a rolling start-time window and admits queued requests in FIFO order. `queue` bounds
the number of waiters; zero disables waiting. `queueTimeout` rejects a request that waits too long.
Abort signals also remove queued requests immediately.

Request hooks finish before admission. A request acquires a concurrency slot, then rate permission
immediately before invoking fetch. Waiting requests cannot accumulate old rate reservations behind a
slow concurrency occupant or asynchronous hook. A concurrency slot remains occupied while waiting
for rate permission and is released if that wait fails. FIFO order begins when requests reach each
queue; hook completion can affect arrival order. `queue`/`queueTimeout` apply to the rate queue,
not the separate concurrency queue. Use an `AbortSignal` to bound all queue waits.

## Hooks

```ts
const api = avirx(baseUrl).on('response', ({ request, response }) => {
    console.log(request().url.href, response()?.status);
});
```

Supported events are `request`, `response`, `retry`, and `error`. Client hooks run before request
hooks for the same event, and hooks run sequentially in registration order.

- `request` runs before policy admission for each network attempt; it can run while another request
  owns capacity. It does not consume a rate start if it throws.
- `response` runs for each network response before retry evaluation.
- `retry` runs after the retry event is created and before its delay.
- `error` runs for Avirx transport, status, abort, timeout, JSON, and validation failures.

A throwing hook stops the active operation; keep hook code small, bounded, and independently
reliable. Throwing terminals propagate response/retry/error-hook exceptions unchanged. In `.result()`,
an `AvirxError` escaping request execution becomes `ok: false`, including errors from response/retry
hooks or an error hook handling a transport failure. Error-hook exceptions during final HTTP status
handling or body parsing/validation reject, including `AvirxError`; other response/retry/error-hook
exceptions also reject. Request-hook failures remain normalized as request failures.

Hooks and auth providers are user-owned asynchronous code. Avirx does not impose a callback timeout;
keep them bounded. Fetch timeouts begin at dispatch, after hooks and queue waits.
