# Development dependency security

Avirx has no runtime dependencies. The published runtime imports no third-party packages;
the dependencies in `package.json` support building, linting, tests, examples, and release checks.

The lockfile was reviewed on 2026-11-01. Both `npm audit` and `npm audit --omit=dev` report
zero vulnerabilities for this dependency graph. An audit result describes the installed graph at
that time; it is not a promise about future advisories.

## Updated dependencies

The refresh removes the advisories in the earlier lockfile through compatible updates:

| Tooling dependency | Locked version | Disposition |
| --- | --- | --- |
| Vitest and its V8 coverage provider | 4.1.12 | Updates the mocker fixes together. |
| Vite | 8.3.5 | Includes the development-server and editor-integration fixes. |
| Zod | 4.6.7 | Includes the oversized-collection validation fix. Used in examples and tests. |
| brace-expansion | 5.0.12 | Includes the recursion and expansion resource-limit fixes. |
| nanoid | 3.3.20 | Includes the custom-generator zero-size fix. |
| source-map-js | 1.2.2 | Includes the indexed-source-map resource-limit fix. |

## Scoped minimatch override

[GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249) affects minimatch
before 11.0.1. The current ESLint and TypeScript ESLint releases still request version 10.
`package.json` therefore pins 11.0.1 only under these three development tooling callers:

- `eslint`
- `@eslint/config-array`
- `@typescript-eslint/typescript-estree`

This is a deliberate major-version override, rather than an automatic audit fix. The upstream
[version 11 changelog](https://github.com/isaacs/minimatch/blob/v11.0.1/changelog.md)
removes APIs including `makeRe`, `AST`, and regular-expression matcher internals. The installed
callers use the preserved `Minimatch.match` method or `minimatch` function. No caller uses the
removed APIs. ESLint still selects every file selected before the override, and the repository's
type, lint, architecture, and package checks exercise the updated tooling.

Remove the overrides when all three callers accept a patched minimatch release directly. Recheck
the callers and lint file selection when updating them; do not replace the pins with an unrestricted
future major. Do not use `npm audit fix --force`, which can propose unrelated tool downgrades.

## Compiler compatibility checks

The packed-package consumer fixture compiles with TypeScript 5.0.4 and the repository compiler,
TypeScript 5.9.3. TypeScript 5.0 is the supported consumer minimum because public declarations use
const type parameters. The older compiler is installed through the `typescript-minimum` development
alias. Scripts invoke each compiler by its explicit package path so the alias's `tsc` executable
cannot silently change the repository's compiler.

Run `npm run smoke:package` to verify the installed declarations with both compilers. This check is
also part of every existing Node package compatibility CI lane and exact-candidate release smoke.

## Artifact size budget

The earlier packed artifact contained 148,614 unpacked bytes. The stabilization candidate measured
156,985 bytes while adding resource cleanup, response lifecycle fixes, and bounded cache controls.
The smoke check keeps a 165,000-byte ceiling, 10% above the earlier 150,000-byte budget. Runtime
dependencies remain empty, and the runtime still consists of one JavaScript entrypoint. The budget
preserves readable output without hiding growth through a minifier change.
