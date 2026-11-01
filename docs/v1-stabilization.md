# V1 stabilization acceptance

Goal: a bounded, documented v1 candidate whose public behavior is covered by consumer, real HTTP,
and native browser regressions. This is a release acceptance gate, not a promise of zero future bugs.
Baseline reviewed: `f97e6fbd77b9e604473f620183c91cbe3edb6ea4` on `main`.

## Confirmed review findings

Implementation is complete for the following findings. The final verification checklist below must
also pass before this candidate is considered ready for review.

| ID | Finding | Disposition and regression |
| --- | --- | --- |
| F01 | Composed abort stops at headers | Native signal composition stays linked to bodies; `execution/body-abort.test.ts` and native browser smoke. |
| F02 | Discarded retries retain bodies | Per-attempt disposal aborts/cancels discarded and hook-failed responses, including locked/tee bodies and throwing error hooks; `execution/retry-disposal.test.ts`. |
| F03 | Dot path values change target | Reject interpolated dot segments before URL parsing; `request-builder/route-safety.test.ts`. |
| F04 | Auth query overrides leak/cache | Redact final auth-named parameters and track authenticated metadata independently; `request-builder/reserved-query-and-auth.test.ts`. |
| F05 | Mutable inspection alters builders | Clone replayable bodies on exposure; freeze query arrays; `request-builder/snapshot-isolation.test.ts`. |
| F06 | Cache buffers streaming send | Send skips cache writes; open streams remain immediately available; `cache/safety.test.ts` and native browser smoke. |
| F07 | Empty rate queues retain wake timer | Clear shared timer after last abort/timeout; queue removals reclaim cancelled entries; `rate-limit/lifetime.test.ts`. |
| F08 | Text/download failures bypass errors | Shared buffered-body error conversion and hooks; `execution/response-body-errors.test.ts`. |
| F09 | Prototype names corrupt keys | Safe dictionaries and own-property checks for headers/query/path/contracts; route/reserved-key and contract tests. |
| F10 | HEAD contracts parse missing JSON | Bodyless HEAD yields undefined; explicit schemas may transform it; `contract/input-output.test.ts`. |
| F11 | Async parser rejects after cache write | Await validation before cache, preserve error hooks and infer awaited output; `schema/async.test.ts` plus type fixtures. |
| F12 | cURL reads files/changes MIME | Literal inline data, inferred MIME, explicit omission for NUL; real HTTP `http/curl-equivalence.test.ts`. |
| F13 | Cache hit loses redirect URL | Preserve public final URL, document synthetic native metadata; `cache/safety.test.ts`. |

Runtime test paths above are relative to `tests/runtime`.

## Additional scope decisions

- Explicitly public-response cache eligibility prevents implicit cookie-session data reuse; privacy
  directives, partial bodies and unsafe variation reject. Native Chromium switches HttpOnly cookie
  sessions and verifies private/no-store data stays fresh.
- Cache storage has finite entry/byte budgets, LRU eviction, normal-operation expiry pruning and
  clear-during-write invalidation. Tests cover oversize/open bodies without waiting for EOF.
- Rate permission is obtained at dispatch after hooks and concurrency. Slow fetches/hooks cannot
  accumulate stale admissions; adversarial `rate-limit/composition` and `dispatch` tests enforce it.
- Schemas support async parsing and separate custom/Zod input and output inference. Unknown-input
  legacy parsers retain output-shaped arguments; typed transforms are explicit.
- Public state and shared advanced policy controls remain supported, with immutable configuration
  and externally owned live-resource exceptions documented and compiled in consumer fixtures.
- ESM-only packaging, minimum Node18.17 and TypeScript5.0.4, native AbortSignal.any and the tested
  browser boundary are explicit. No CommonJS bundle or full RFC cache is added.
- Tooling advisories are resolved through compatible updates and narrowly reviewed overrides;
  [tooling-security.md](./tooling-security.md) records rationale and removal conditions.

## Final verification

The draft PR records completion and exact-head results for these acceptance checks.

- Typecheck, ESLint and architecture checks pass on the final commit.
- Complete Vitest suite and coverage thresholds pass.
- Packed package passes real HTTP, public API fixtures and TypeScript5.0.4/5.9.3 consumers.
- Packed Chromium smoke passes native fetch/session/stream regressions and Web API fixtures.
- Full and production-only dependency audits report zero advisories.
- Working tree and PR contain only this stabilization scope.
- Remote branch equals the verified local commit and its required CI jobs pass.

Release candidates must retain these regressions and the existing Node18.17/22/24/26 gates.
An actual release still requires separate human review; this work opens a draft PR only.

## Fresh-review follow-up

All four residual P2 findings from the review of `20c2c6c766133db30a9f1cf2bd7928edc22c029c`
are addressed in this follow-up. Their focused regressions failed before the product changes.

| Finding | Disposition and regression |
| --- | --- |
| R1: CORS hides Vary | Explicit basic/default-only response eligibility; native Chromium uses two origins and checks hidden and exposed Vary responses never enter the cache. Same-origin caching remains covered. |
| R2: Missing/empty vary collision | Missing values use a distinct key sentinel; consumer tests request absent and empty fields against different public representations. |
| R3: Whitespace bypasses dot guard | Reject static C0 controls and leading/trailing ASCII spaces before interpolation; relative/absolute templates reject through inspection and execution without dispatch. Safe interior/encoded data remains covered. |
| R4: cURL removes empty headers | Semicolon syntax preserves empty headers; real HTTP compares body bytes and content-type/x-empty/accept/user-agent presence against native fetch. |

The hook-error documentation now describes the existing `.result()` execution-catch boundary;
`failure/result-hook-errors.test.ts` covers nested request errors and error hooks at each phase.
This clarification changes no runtime API or error behavior. Cross-origin browser cache bypass and
route-template rejection are deliberate pre-v1 compatibility changes, documented in the guides.
