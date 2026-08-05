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

The cache is an in-memory store owned by that client policy. It defaults to `GET`, varies on `accept`,
and accepts `HEAD` only when requested explicitly. Entries expire lazily according to `ttl`.

A request bypasses caching when it:

- uses a method outside the configured `GET` or `HEAD` set;
- contains an auth policy or a sensitive header;
- has a redacted URL that differs from the real URL.

Only successful 2xx responses are stored. With `maxBytes`, a response must provide a valid
`Content-Length` within the limit and its cloned body must also remain within the limit. A cache hit
returns a fresh `Response` backed by a copy of the stored bytes and reports zero-duration timing.

Cache lookup happens before admission policies and hooks. A hit therefore does not consume
rate-limit or concurrency capacity and does not run request or response hooks. Cache writes happen
after the selected terminal has processed the response successfully; invalid JSON or schema output is
not cached.

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

Rate-limit admission occurs before concurrency admission. This means an admitted request may still
wait for a concurrency slot, but concurrency pressure does not consume additional rate-limit starts.

## Hooks

```ts
const api = avirx(baseUrl).on('response', ({ request, response }) => {
    console.log(request().url.href, response()?.status);
});
```

Supported events are `request`, `response`, `retry`, and `error`. Client hooks run before request
hooks for the same event, and hooks run sequentially in registration order.

- `request` runs after policy admission and immediately before each network attempt.
- `response` runs for each network response before retry evaluation.
- `retry` runs after the retry event is created and before its delay.
- `error` runs for Avirx transport, status, abort, timeout, JSON, and validation failures.

Hook failures are not swallowed. A throwing hook stops the active operation, so hook code should be
small, bounded, and independently reliable.
