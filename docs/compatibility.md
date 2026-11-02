# Compatibility and the v1 boundary

Avirx publishes one ESM entrypoint with TypeScript declarations and zero runtime dependencies.
CommonJS `require()` and deep imports into `dist` or `src` are not supported.

## Supported environments

| Surface | Contract and verification |
| --- | --- |
| Node.js | Minimum 18.17; installed-package compatibility at that floor, full CI on Node 22/24/26. Supporting an old runtime does not imply its upstream security support. |
| TypeScript | Minimum 5.0.4; packed consumer fixtures compile with 5.0.4 and the repository's 5.9.3 compiler. Strict mode and DOM declarations are required for Web API types. |
| Browsers | Modern Web APIs including native `AbortSignal.any`; real Chromium tests cover package loading, native fetch, cookie privacy, cross-origin cache bypass, public caching, streaming, and composed cancellation. Firefox/WebKit have no dedicated CI gate. |
| Other runtimes | Best effort when they provide compatible fetch, URL, Request, Response, Headers, Blob, FormData, ReadableStream, AbortController, AbortSignal.any and performance.now(). |

Native `AbortSignal.any` keeps cancellation attached to native response bodies without manually
retained listeners. Avirx fails clearly when a requested policy requires unavailable composition.
Custom fetch implementations must honor the supplied signal, redirect policy and Web API behavior. Fetch controls
wire-level header restrictions: Node24.19 fetch drops a header literally named `__proto__` even when
its Request/Headers value preserves it. Avirx preserves that key in builders and injected-fetch input;
it does not replace the transport to work around this upstream behavior.

## Supported public API

The root exports, their declarations, and documented builder/terminal behavior form the supported
surface. Public `state` and `clientState` remain intentional APIs, including the advanced policy
handles described below. They are not private escape hatches that a v1 patch can silently remove.

- Configuration records, explicit headers, path/query values, expected statuses, and hook lists are frozen
  snapshots. Changing a derived builder does not change its source.
- URL values and replayable mutable bodies obtained from state, build, or preview are independent
  copies. Mutating such a copy cannot rewrite another request. Blob values are already immutable.
- Streams are single-use native resources; Avirx does not make them replayable. Native Responses,
  signals, fetch functions, schema objects and callbacks retain their external identity and behavior.
- Cache and limiter objects are shared live handles across derived clients. Cache `get/set/clear`
  and limiter `acquire` are supported advanced controls; their mutations affect clients sharing that
  policy. A caller acquiring concurrency directly must release the returned slot exactly once.
  Prefer builder policies and diagnostic `active/queued/starts/size` methods in ordinary application code.
- Public auth state is redacted. Built requests necessarily contain actual credentials; treat them
  as sensitive. Preview/cURL redact known auth fields, including overridden query fields.

A future v1 patch must preserve these contracts. Major changes to method signatures, supported
compiler/runtime floors, policy ownership, terminal results or error semantics require a major
version after 1.0. Adding optional capabilities may use a minor version. Implementation details,
module layout, function source text, timing measurements and stack traces are not stable APIs.

## Intentional changes from 0.1.0

This stabilization candidate is pre-v1 and deliberately corrects these behaviors:

- Caching requires server `Cache-Control: public`, respects privacy exclusions, has finite storage
  budgets and explicit invalidation. Only unfiltered `basic`/`default` responses are cacheable;
  browser CORS responses bypass caching even when `Vary` is exposed. `.send()` does not write a
  body cache entry. Missing and explicitly empty vary fields have different keys.
- Hooks run before admission; concurrency precedes rate admission immediately before dispatch.
  Fetch timeout starts at dispatch and ends at headers. Signals cancel response bodies too.
- Dot-segment path parameters reject. Route templates with static C0 controls or leading/trailing
  ASCII spaces reject before URL normalization. Reserved object names are preserved as data.
- Mutable inspection values are independent snapshots; nested query arrays are frozen.
- Built requests carry required `authenticated` metadata for safe cache eligibility.
- HEAD JSON/contract results are `undefined` unless an explicit schema transforms that value.
- Async schemas are awaited, and contract input/output inference follows the documented parser rules.
- cURL uses literal inline data with effective content type and preserves explicitly empty headers;
  unrepresentable NUL bodies are omitted.

Further deliberate decisions from the detailed review of `e8e6c12`:

- Protected custom credentials reject redirects by default; creation-time `allowCredentialRedirects`
  explicitly trusts the full chain. Native Authorization and ordinary redirect behavior are retained.
- Conditional/range requests bypass cache reads and writes. Clear blocks older automatic operations
  from refilling storage; explicit low-level set after clear is a new write.
- Inferred JSON MIME lives in built headers, not explicit state headers. Body replacement preserves
  only caller-owned MIME. Relative route suffixes, including root slash counts, are preserved.
- URL userinfo, malformed/unsafe placeholder names, reserved contract `then`, and symbol contract
  keys reject. Own non-enumerable string contract keys are supported.
- `AvirxRequestBuilder` defaults to a common-capability view; body helpers specify the second generic
  as `true`. Exact awaited path-schema outputs and unknown-property rejection are enforced.
- `AvirxError.kind` is stable. Hooks/auth providers reject unchanged across all terminals; operation
  failures become result values, and cancellation belongs to the current request.
- Elapsed policies use monotonic time. Absolute HTTP dates/public timestamps retain wall time.

See [the acceptance checklist](./v1-stabilization.md) for each review finding and its regression.
