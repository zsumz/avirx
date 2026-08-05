# Runtime behavior

Avirx builds immutable request values and executes them with the platform `fetch` implementation.
It has no runtime dependencies and does not replace the underlying HTTP transport.

## Runtime support

The package requires Node.js 18.17 or a runtime with compatible `fetch`, `Request`, `Response`,
`Headers`, `Blob`, `FormData`, `ReadableStream`, and `AbortController` globals.

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
3. Acquire rate-limit admission, then a concurrency slot.
4. Start the per-attempt timeout and run request hooks.
5. Call `fetch` and create the Avirx response.
6. Run response hooks and decide whether to retry.
7. Parse or validate the terminal result.
8. Write a cache entry after successful terminal processing.

Authentication providers are evaluated for every attempt. The timeout covers the fetch attempt, not
time spent waiting for rate-limit or concurrency admission. Use an `AbortSignal` or a rate-limit
`queueTimeout` when queue wait also needs a bound.

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
instead of consuming or misrepresenting them.

To read a streaming response, use `.send()` and consume `response.native.body` directly. The JSON,
text, schema, result, and download terminals buffer or parse a cloned response body.

## Cancellation and timeouts

Client and request signals are combined. Aborting either signal cancels an active fetch, retry delay,
rate-limit wait, or concurrency wait. The original signal reason is retained as the error cause.

```ts
const controller = new AbortController();
const result = api.get('/slow').signal(controller.signal).result();
controller.abort(new Error('No longer needed.'));
```

Client timeouts are inherited by requests. A request may override the duration or use
`.timeout(false)` to disable the inherited timeout. Each retry receives a fresh attempt timeout.

## Statuses, terminals, and errors

Statuses from 200 through 299 are expected by default. `.expect(status)` or `.expect(statuses)`
replaces that default for one request.

- `.send()` returns an `AvirxResponse` with the untouched native `Response`.
- `.text()` and `.json()` parse a cloned body; JSON returns `undefined` for 204 and 205.
- `.as(schema)` parses JSON and then calls the schema's `parse` method.
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
