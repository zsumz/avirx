# Detailed review dispositions

Baseline: `e8e6c120e5010024f95e15cf5783f92bf77014ea` on `codex/v1-stabilization`.
The complete supplied review was read before implementation. The listed defect reproductions were
validated; recommendations were evaluated as contract decisions rather than assumed regressions.
No release, merge, deployment or security-settings change is part of this pass.

## Priority findings

| Item | Disposition | Regression boundary |
| --- | --- | --- |
| F1 (P1): Custom credentials follow redirects across origins | Resolved. Managed custom secret headers and known direct secret headers reject redirects by default. `allowCredentialRedirects: true` explicitly trusts the entire chain. Bearer stripping and ordinary redirects retain native behavior. | Two real HTTP origins and native Chromium verify the default never reaches origin B, while explicit opt-in sends only the fake fixture credential. |
| F2 (P2): Conditional/range requests reuse ordinary cache | Resolved. Presence of all six Range/If-* fields bypasses both reads and writes, including empty values. | 24 cases cover warm-first and reverse order, statuses and bodies. |
| F3 (P2): Body replacement retains inferred JSON MIME | Resolved. Inference occurs at final build; explicit headers remain caller-owned. | 1,296 native Request serializations and 243 wire-level body transitions cover MIME, multipart boundaries and no-body replacements. |
| F4 (P2): Relative routes erase trailing separators | Resolved. Route suffixes and slash-only roots are preserved; empty/query-only routes retain the exact base pathname. | Relative/absolute/base-prefix/root/query/hash matrices and native HTTP wire paths. |
| F5 (P2): Sibling abort reason steals request identity | Resolved. Cancellation is classified around the current request, with original reason as cause. | Pre-abort, native fetch, buffered body, concurrency, rate queue and retry delay use sibling AvirxError reasons. |
| F6 (P2): Contradictory builder never index signature | Resolved. Neutral branches add no index signature; the broad builder is a common-capability helper view. | Strict packed consumers on TS5.0.4/5.9.3, with noUncheckedIndexedAccess disabled, reject unknown properties and accept plain/templated/shared helpers. |

The six range/conditional fields are `Range`, `If-Range`, `If-Match`, `If-None-Match`,
`If-Modified-Since`, and `If-Unmodified-Since`.

## Smaller reproduced cases

| Item | Disposition |
| --- | --- |
| Contract endpoint then becomes a thenable | Resolved: reserve then at runtime and in definition/output types before Promise assimilation can cause a request. |
| Symbol contract keys disappear | Resolved: reject all symbols; preserve own string keys, including non-enumerable properties. Inherited keys are outside the string-record contract. |
| Unusual placeholder names bypass dot checks | Resolved: matching runtime/type grammar excludes empty names, separators, braces, controls and whitespace. Dots/colons/hyphens/Unicode/reserved object names remain valid. |
| Wall-clock jumps change elapsed policies | Resolved: rate windows, TTL and response durations use performance.now; absolute HTTP dates and public timestamps retain wall time. Six old-clock regressions failed before correction. |
| URL userinfo leaks through inspection | Resolved: unsupported credentials reject in base and route URLs, before preview/build/cURL or transport; messages omit the credentials. |
| Extra path-schema output keys compile but cannot run | Resolved: exact awaited output keys are enforced at definition; runtime validation remains in place for type-erased input. |

## Contract decisions

- Adopted stable `AvirxError.kind`: aborted, timeout, network, http, decode, validation, queue-full,
  queue-timeout, unknown. Messages remain descriptive text, not the discriminator.
- Adopted consistent hook/auth-provider failure semantics: every terminal rejects the original
  thrown value. Successful-response parser failures become validation results; error-body parser
  failures retain the HTTP error and cause, and contract input failures reject during preflight.
  This deliberately supersedes the phase-dependent hook behavior documented at the baseline.
- Adopted stronger clear semantics: earlier automatic operations cannot refill the cache after clear,
  including pending auth, hooks, fetch, retries and input/output schema validation. A caller still
  receives its in-flight operation result. Explicit set after clear is a new write; clear during its
  body copy still prevents storage.
- Retained supported public inspection and advanced policy handles. Consumer fixtures preserve them;
  callers using acquire directly own slot release, and explicit cache writes own their mutation
  intent. Removing these controls was considered and is not needed for these fixes.
- Preserved timeout-to-headers and concurrency-to-headers semantics, raw native body ownership, and
  caller-settlement requirements for callbacks. Stored-cache byte limits do not bound all transient
  memory. Consume or cancel retained native bodies, including error responses.
- Preserved the architecture and browser support boundary. Added focused private error, generation,
  elapsed-clock and type helpers; no HTTP transport replacement, RFC cache engine, dependency, or
  browser-support expansion. The duplicate Content-Length parser reuses the existing shared rule.

## Validation and review

Deterministic body/template combinations supplement the existing focused tests without a property
framework dependency. New defect regressions were run against the old behavior before the fixes.
`http/consumer-workflow.test.ts` exercises native authentication refresh, derived multipart upload,
cache invalidation and cancelled streaming in one representative consumer flow.

Independent read-only reviewers challenged security/error/cache integration and API/URL/clock
integration and reported no further confirmed defects. Full type/lint/architecture, runtime coverage,
packed consumers, native Chromium, dependency audits and exact-head remote CI remain required for
this candidate. The final execution record and prepared PR description retain their measured results.

PR creation remains the previously denied GitHub integration operation; this pass does not retry it
without changed permission evidence. A branch push or passing CI is not a release or merge approval.
