# Compatibility and the v1 boundary

Avirx publishes one ESM entrypoint with TypeScript declarations and zero runtime dependencies.
CommonJS `require()` and deep imports into `dist` or `src` are not supported.

## Supported environments

| Surface | Contract and verification |
| --- | --- |
| Node.js | Minimum 18.17; installed-package compatibility at that floor, full CI on Node 22/24/26. Supporting an old runtime does not imply its upstream security support. |
| TypeScript | Minimum 5.0.4; packed consumer fixtures compile with 5.0.4 and the repository's 5.9.3 compiler. Strict mode and DOM declarations are required for Web API types. |
| Browsers | Modern Web APIs including native `AbortSignal.any`; real Chromium tests cover package loading, native fetch, cookie privacy, public caching, streaming, and composed cancellation. Firefox/WebKit have no dedicated CI gate. |
| Other runtimes | Best effort when they provide compatible fetch, URL, Request, Response, Headers, Blob, FormData, ReadableStream, AbortController and AbortSignal.any. |

Native `AbortSignal.any` keeps cancellation attached to native response bodies without manually
retained listeners. Avirx fails clearly when a requested policy requires unavailable composition.
Custom fetch implementations must honor the supplied signal and Web API behavior. Fetch controls
wire-level header restrictions: Node24.19 fetch drops a header literally named `__proto__` even when
its Request/Headers value preserves it. Avirx preserves that key in builders and injected-fetch input;
it does not replace the transport to work around this upstream behavior.

## Supported public API

The root exports, their declarations, and documented builder/terminal behavior form the supported
surface. Public `state` and `clientState` remain intentional APIs, including the advanced policy
handles described below. They are not private escape hatches that a v1 patch can silently remove.

- Configuration records, headers, path/query values, expected statuses, and hook lists are frozen
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
  budgets and explicit invalidation. `.send()` does not write a body cache entry.
- Hooks run before admission; concurrency precedes rate admission immediately before dispatch.
  Fetch timeout starts at dispatch and ends at headers. Signals cancel response bodies too.
- Dot-segment path parameters reject; reserved object names are preserved as data.
- Mutable inspection values are independent snapshots; nested query arrays are frozen.
- Built requests carry required `authenticated` metadata for safe cache eligibility.
- HEAD JSON/contract results are `undefined` unless an explicit schema transforms that value.
- Async schemas are awaited, and contract input/output inference follows the documented parser rules.
- cURL uses literal inline data with effective content type; unrepresentable NUL bodies are omitted.

See [the acceptance checklist](./v1-stabilization.md) for each review finding and its regression.
