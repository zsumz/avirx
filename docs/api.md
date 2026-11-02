# API and contracts

```ts
import { avirx, endpoint, type AvirxSchema } from 'avirx';

const Book = {
    parse(input: unknown): { id: string; title: string } {
        if (typeof input !== 'object' || input === null) throw new Error('Expected a book.');
        const value = input as Record<string, unknown>;
        if (typeof value.id !== 'string' || typeof value.title !== 'string') {
            throw new Error('Expected a book id and title.');
        }
        return { id: value.id, title: value.title };
    },
};

const api = avirx('https://api.example.com');
const request = api.get('/books/{id}').path({ id: 'book_123' }).query({ include: ['author'] });
const preview = await request.preview();
const book = await request.as(Book);
```

Builders are reusable values, with a single-use exception for native request streams. Supported
methods are GET, HEAD, POST, PUT, PATCH, DELETE and OPTIONS. Base paths are joined with relative
routes; absolute routes replace the base URL and retain configured policies, including auth.
Only pass trusted absolute destinations to an authenticated client. URL username/password fields
are unsupported and reject before inspection or dispatch; use an auth policy instead. Relative joins
preserve trailing route slashes: `/items` and `/items/` remain different resources. An empty or
query-only route preserves the base pathname; slash-only routes append their exact slash count
beneath the base prefix.

`.path()` accepts the route's exact template keys and URI-encodes values. It rejects missing/extra
keys and interpolated dot segments. Static C0 controls and leading/trailing ASCII spaces in route
templates reject; use percent-encoded characters or parameter/query values for intentional data.
Placeholder names are nonempty and exclude URL separators (`/`, `\`, `?`, `#`), braces, whitespace
and controls. Dots, colons, hyphens, Unicode and names such as `constructor` remain supported.
Query arrays become repeated values; later query calls replace
matching keys. JSON bodies snapshot at attachment. Use `.multipart().field(...).file(...)` for forms.

## Choosing a terminal

| Terminal | Result |
| --- | --- |
| `send()` | Response metadata and native streaming body; caller owns consumption/cancellation. |
| `json<T>()` | Parsed JSON with a caller-supplied static type; it does not validate T. |
| `as(schema)` | Parsed JSON validated/transformed by a synchronous or asynchronous parser. |
| `text()` / `download()` | Text or Blob plus download metadata. |
| `result(schema?)` | Discriminated success/error value for Avirx execution failures. |

JSON is `undefined` for HEAD, 204 and 205. An explicit schema receives that value and can accept or
reject it. `.expect(...)` replaces the default 2xx status set. `.error(schema)` validates only an
unexpected HTTP response body. Buffered transport/parsing/validation failures carry `AvirxError`
with request, available response/status, and cause. `error.kind` is the stable discriminator:
`aborted`, `timeout`, `network`, `http`, `decode`, `validation`, `queue-full`, `queue-timeout`, or
`unknown` for user-constructed errors without an explicit kind. Cancellation always identifies the
current operation; a sibling error used as the abort reason remains its cause, not its HTTP status.

Hooks and auth-provider failures reject their original thrown value from every terminal, including
`.result()`. They do not become HTTP operation results or invoke operation error hooks recursively.
Successful-response schema failures become `validation` operation failures. An `.error(schema)`
failure retains `kind: 'http'` and the parser failure as its cause. Contract input parsing happens
during preflight and rejects the original value. A custom fetch is the transport: its failures are
normalized to the current request as network/cancellation failures.

```ts
const outcome = await request.result(Book);
if (!outcome.ok && outcome.error.kind === 'aborted') {
    console.log('Review cancelled.');
}
```

A broad `AvirxRequestBuilder` is a common-capability view for helpers accepting GET/HEAD and
body-capable builders, including templated routes. A helper that needs body methods should declare
`AvirxRequestBuilder<Route, true>`. Concrete POST/PUT/PATCH builders retain those methods. Unknown
properties are type errors even without `noUncheckedIndexedAccess`.

## Contracts and schemas

```ts
const books = api.contract({
    getBook: endpoint.get('/books/{id}').returns(Book),
    exists: endpoint.head('/books/{id}'),
});
const found = await books.getBook({ path: { id: 'book_123' } });
const existence = await books.exists.result({ path: { id: 'book_123' } });
if (existence.ok) console.log(existence.response.headers); // data is undefined
```

Contracts use own string keys, including non-enumerable own string properties. `then` is reserved
to prevent Promise assimilation, and symbol keys reject at both the type and runtime boundary.
Inherited keys are not part of the contract. Path-schema outputs must contain exactly the route's
keys; awaited outputs with extra keys are rejected at the definition boundary.

Use `.params(schema)`, `.query(schema)` and `.body(schema)` to declare contract inputs. Input
validation completes before fetch; failures reject both the call and its `.result()` preflight.
Response validation completes before cache insertion. Async input, output and error parsers are
supported. Terminal outputs infer the awaited parser result.

For a transforming custom input parser, declare its actual input type:

```ts
const Page: AvirxSchema<{ limit: number }, { limit: string }> = {
    parse(input) {
        const limit = Number(input.limit);
        if (!Number.isSafeInteger(limit) || limit < 1) throw new Error('Invalid limit.');
        return { limit };
    },
};
const catalog = api.contract({ list: endpoint.get('/books').query(Page) });
await catalog.list({ query: { limit: '10' } });
```

Zod input metadata is inferred automatically, including transformations. For backward compatibility,
a custom parser accepting `unknown` (or no argument) uses its output shape as the contract caller's
input type. Annotate `AvirxSchema<Output, Input>` or a typed parse parameter when input differs.
`parseWithSchema` is the direct utility: it returns the parser's raw value or Promise, without HTTP
error wrapping. Runtime schemas, their side effects, and external callbacks remain caller-owned.

See [policies](./policies.md), [runtime behavior](./runtime.md), and
[compatibility](./compatibility.md) for ownership, caching, cancellation and support guarantees.
