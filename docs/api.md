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
Only pass trusted absolute destinations to an authenticated client.

`.path()` accepts the route's exact template keys and URI-encodes values. It rejects missing/extra
keys and interpolated dot segments. Query arrays become repeated values; later query calls replace
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
with request, available response/status, and cause. Request-hook failures also become request
failures. Response/retry/error-hook failures propagate directly; result mode does not hide arbitrary
callback/programming failures.

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
