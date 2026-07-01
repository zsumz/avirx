# Comparison

Avirx is for people who like `fetch`, but want request code that is easier to
inspect, test, and trust.

Most HTTP clients make the call nicer. Avirx makes the request itself a value.

## Why This Exists

```ts
const request = api
    .get('/books/{id}')
    .path({ id: 'book_123' })
    .query({ include: ['author', 'reviews'] });

console.log(await request.preview());
console.log(await request.curl());

const book = await request.as(Book);
```

That is the main idea. Build the request once, then preview it, render it as
cURL, clone it, validate it, or send it.

## What Avirx Has

- Immutable request builders.
- Typed path params from routes like `/books/{id}`.
- Redacted `preview()` and `curl()` output.
- `.send()`, `.as(schema)`, `.result(schema)`, and `.download()` terminals.
- Typed success and error response bodies.
- Retry, timeout, hooks, cache, concurrency, and rate-limit policies.
- Zero runtime dependencies.

## How It Compares

| Library | Use it when | Try avirx when |
| --- | --- | --- |
| `fetch` | You want the platform API directly. | You want fetch plus typed, inspectable request values. |
| Axios | You want the mature all-purpose HTTP client. | You want a smaller fetch-first client with immutable builders. |
| Ky | You want a polished fetch wrapper. | You want request previews, cURL output, and explicit terminals. |
| Got | You need deep Node.js transport features. | You want standard fetch APIs across modern runtimes. |
| ofetch | You want convenient auto-parsing fetch. | You want explicit parsing and typed result values. |
| openapi-fetch | Your OpenAPI schema is the source of truth. | You want typed routes and schemas without code generation. |

## Tradeoff

Avirx is young and focused. It is not trying to be the biggest HTTP ecosystem or
the deepest Node transport library.

It exists because request code is easier to work with when requests are typed,
immutable, inspectable values.

## Links

- [Axios](https://axios.rest/pages/getting-started/features)
- [Ky](https://github.com/sindresorhus/ky)
- [Got](https://github.com/sindresorhus/got)
- [ofetch](https://github.com/unjs/ofetch)
- [openapi-fetch](https://openapi-ts.dev/openapi-fetch/)
