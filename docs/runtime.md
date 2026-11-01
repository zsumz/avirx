# Runtime behavior

Avirx builds immutable request values and executes them with the platform `fetch` implementation.
It has no runtime dependencies and does not replace the underlying HTTP transport.

## Runtime support

The package requires Node.js 18.17 or a runtime with compatible `fetch`, `Request`, `Response`,
`Headers`, `Blob`, `FormData`, `ReadableStream`, `AbortController`, and native `AbortSignal.any`
globals. See [compatibility](./compatibility.md) for the tested matrix and compiler baseline.

CI runs source, unit, architecture, and packed Node gates on maintained Node release lines and the
current Node release. One maintained Node lane also enforces coverage thresholds and runs the packed
artifact in real headless Chromium. That browser lane includes a scan for Node-only imports and
globals. The declared Node 18.17 minimum runs the installed-package Node compatibility smoke.

Pass a custom `fetch` implementation as the second argument when the host does not provide one or
when a test needs a controlled transport:

```ts
const api = avirx('https://api.example.com', { fetch: fetchImpl });
```

## Request lifecycle

Every terminal follows the same high-level path:

1. Resolve authentication and build an immutable request snapshot.
2. Return a valid cache hit, if one exists.
3. Run request hooks and check cancellation.
4. Acquire a concurrency slot, then rate-limit admission immediately before dispatch.
5. Start the per-attempt timeout, call `fetch`, and create the Avirx response.
6. Run response hooks and decide whether to retry.
7. Parse or validate the terminal result.
8. Write an eligible public cache entry after successful buffered terminal processing.
   `.send()` does not buffer or write its response into the cache.

Authentication providers are evaluated for every attempt. The timeout covers the fetch attempt, not
time spent in authentication providers, hooks, queues, or response body consumption. Use an
`AbortSignal` to cancel queues and transport. Authentication providers and hooks must themselves
settle; Avirx checks cancellation after they complete. A rate-limit `queueTimeout` bounds that limiter's queue only.

## Request bodies

| Input | Behavior |
| --- | --- |
| Plain object or array | Snapshotted as JSON and sent with `application/json` unless a content type already exists. |
| String | Sent as text. |
| `URLSearchParams` | Cloned and sent as form-encoded data. |
| `ArrayBuffer` | Cloned before it becomes request state. |
| `Blob` | Sent as binary data with its type and size metadata. |
| `FormData` | Cloned when attached; runtime multipart boundaries remain transport-owned. |
| `ReadableStream` | Sent with native streaming semantics and `duplex: 'half'` for Node fetch. |
| `null` or `undefined` | Treated as no request body. |

`GET` and `HEAD` reject body and multipart calls. Stream and `FormData` bodies are not retried because
they cannot be replayed safely. The default cURL renderer omits multipart, binary, and stream bodies
instead of consuming or misrepresenting them. Inspection returns independent copies of replayable
mutable bodies. Streams retain their native single-use identity. Path parameters that form a complete
`.` or `..` segment are rejected before URL normalization can change the target resource. Route
templates reject static C0 controls (U+0000–U+001F) and leading/trailing ASCII spaces before
interpolation; interior spaces and explicitly percent-encoded characters remain supported. Parameter
values are still URI-encoded, so a tab inside a parameter is data rather than static URL whitespace.

To read a streaming response, use `.send()` and consume `response.native.body` directly. The JSON,
text, schema, result, and download terminals buffer or parse a cloned response body.

## Cancellation and timeouts

Client and request signals are combined. Aborting either signal cancels an active fetch, retry delay,
rate-limit wait, concurrency wait, or native response body read. The original signal reason is retained
as the error cause. Native signal composition remains connected after headers; it requires
`AbortSignal.any`. A custom fetch implementation must honor the provided signal.

```ts
const controller = new AbortController();
const result = api.get('/slow').signal(controller.signal).result();
controller.abort(new Error('No longer needed.'));
```

Client timeouts are inherited by requests. A request may override the duration or use
`.timeout(false)` to disable the inherited timeout. Each retry receives a fresh attempt timeout.
The timeout ends at response headers. It does not limit download duration; abort a signal to stop a
response body. Discarded retry responses and hook-failure responses are cancelled to release resources.

## Statuses, terminals, and errors

Statuses from 200 through 299 are expected by default. `.expect(status)` or `.expect(statuses)`
replaces that default for one request.

- `.send()` returns an `AvirxResponse` with the untouched native `Response`.
- `.text()` and `.json()` parse a cloned body; JSON returns `undefined` for HEAD, 204, and 205.
- `.as(schema)` parses JSON and then awaits the schema's synchronous or asynchronous `parse` method.
- `.result(schema?)` converts `AvirxError` failures into an `ok: false` value.
- `.download()` returns the response, `Blob`, status, and available content metadata.

Unexpected statuses, transport failures, timeouts, aborts, JSON failures, and schema failures use
`AvirxError`. It carries the built request and, when available, the response, status, parsed error
data, and original cause. A custom error schema attached with `.error(schema)` is used only for an
unexpected HTTP response body.

## Inspection and redaction

`.preview()` and `.curl()` redact authorization, cookies, common API-key headers, and credentials
added by Avirx auth policies. Query API keys are replaced in the rendered URL. Public client and
request state stores redacted auth metadata rather than raw credentials.

Redaction is deliberately scoped to headers and auth query parameters. Avirx does not inspect or
sanitize arbitrary path values, query values, or request bodies. Do not place secrets in those fields
and assume preview output will remove them. `.curl({ redacted: false })` explicitly renders raw auth
headers and URLs and should be treated as sensitive output.

Buffered terminal transport failures use the same `AvirxError` and error hooks as fetch failures.
Request-hook failures are normalized as request failures and run error hooks. Throwing terminals
propagate response/retry/error-hook exceptions unchanged. `.result()` converts an `AvirxError`
escaping request execution to `ok: false`, including one thrown by a response/retry hook or an error
hook handling a transport failure. A nested callback request can therefore supply the returned
error's request metadata. Error-hook exceptions during final status handling or body parsing/validation
reject, including `AvirxError`; other response/retry/error-hook exceptions also reject. Contract input
validation remains preflight and rejects. See [hooks](./policies.md#hooks) for the same boundary.
