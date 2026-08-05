<p align="center">
  <img src="./avirx-logo.svg" alt="avirx" width="720">
</p>

<p align="center">
  <strong>Typed, inspectable HTTP requests on top of fetch.</strong>
</p>

<p align="center">
  <a href="https://github.com/zsumz/avirx/actions/workflows/ci.yml"><img src="https://github.com/zsumz/avirx/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
</p>

<p align="center">
  Build requests as immutable values, preview them, render cURL, validate responses, then execute.
</p>

<p align="center">
  <a href="#install">Install</a>
  <span> · </span>
  <a href="#example">Example</a>
  <span> · </span>
  <a href="#model">Model</a>
  <span> · </span>
  <a href="#features">Features</a>
  <span> · </span>
  <a href="#runtime">Runtime</a>
  <span> · </span>
  <a href="#guides">Guides</a>
</p>

<br />

## Install

```sh
npm install avirx
```

## Example

```ts
import { avirx } from 'avirx';

const Book = {
    parse(input: unknown): { id: string; title: string } {
        return input as { id: string; title: string };
    },
};

const api = avirx('https://api.example.com');

const request = api
    .get('/books/{id}')
    .path({ id: 'book_123' })
    .query({ include: ['author', 'reviews'] });

console.log(await request.preview());
console.log(await request.curl());

const book = await request.as(Book);
```

## Model

Avirx treats requests as values. Build a request once, then inspect, clone, or execute it
without hidden mutation.

```ts
const result = await api
    .get('/books/{id}')
    .path({ id: 'missing' })
    .result(Book);

if (!result.ok) {
    console.log(result.status);
}
```

## Features

- Immutable fluent request builders
- Typed path parameters from route strings
- Query, JSON body, multipart upload, and download helpers
- Runtime schema validation with any parser that exposes `parse`
- Result mode for expected HTTP failures
- Redacted preview and cURL output
- Auth, timeout, retry, hooks, cache, concurrency, and rate-limit policies
- Zero runtime dependencies

## Runtime

Avirx requires Node.js 18.17 or newer, or any runtime with compatible fetch,
Request, Response, Headers, Blob, FormData, and AbortController APIs.

## Guides

- [Runtime behavior](https://github.com/zsumz/avirx/blob/main/docs/runtime.md)
- [Policies](https://github.com/zsumz/avirx/blob/main/docs/policies.md)
- [Comparison](https://github.com/zsumz/avirx/blob/main/COMPARISON.md)
