export const serverSmokeSource = `import assert from "node:assert/strict";
import { createServer } from "node:http";
import { avirx } from "avirx";

let retryAttempts = 0;
const server = createServer((request, response) => {
  void handleRequest(request, response).catch((error) => {
    response.statusCode = 500;
    response.end(JSON.stringify({ message: String(error) }));
  });
});

await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", resolve);
});

const address = server.address();
assert(address && typeof address === "object");
const baseUrl = \`http://127.0.0.1:\${address.port}\`;

const RecordSchema = {
  parse(input) {
    assert(input && typeof input === "object");
    return input;
  },
};

try {
  const api = avirx(baseUrl)
    .auth.bearer(() => "server-token")
    .retry(1)
    .timeout("1s");

  const book = await api
    .get("/books/{id}")
    .path({ id: "book 123" })
    .query({ include: ["author", "reviews"] })
    .as(RecordSchema);
  assert.deepEqual(book, {
    id: "book 123",
    include: ["author", "reviews"],
  });

  const retried = await api.get("/retry").as(RecordSchema);
  assert.deepEqual(retried, { attempts: 2 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode("streamed "));
      controller.enqueue(encoder.encode("body"));
      controller.close();
    },
  });
  const streamed = await api.post("/stream").body(stream).as(RecordSchema);
  assert.deepEqual(streamed, { body: "streamed body" });

  const controller = new AbortController();
  const cancellation = api.get("/slow").signal(controller.signal).result(RecordSchema);
  setTimeout(() => controller.abort(new Error("No longer needed.")), 20);
  const cancelled = await cancellation;
  assert.equal(cancelled.ok, false);
  assert.equal(cancelled.error.message, "Request aborted.");
} finally {
  await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

async function handleRequest(request, response) {
  const url = new URL(request.url ?? "/", baseUrl);
  if (url.pathname.startsWith("/books/")) {
    assert.equal(request.headers.authorization, "Bearer server-token");
    writeJson(response, {
      id: decodeURIComponent(url.pathname.slice("/books/".length)),
      include: url.searchParams.getAll("include"),
    });
    return;
  }
  if (url.pathname === "/retry") {
    retryAttempts += 1;
    if (retryAttempts === 1) {
      writeJson(response, { attempts: retryAttempts }, 503);
      return;
    }
    writeJson(response, { attempts: retryAttempts });
    return;
  }
  if (url.pathname === "/stream") {
    const chunks = [];
    for await (const chunk of request) {
      chunks.push(chunk);
    }
    writeJson(response, { body: Buffer.concat(chunks).toString("utf8") });
    return;
  }
  if (url.pathname === "/slow") {
    await new Promise((resolve) => setTimeout(resolve, 200));
    writeJson(response, { ok: true });
    return;
  }
  writeJson(response, { code: "not_found" }, 404);
}

function writeJson(response, value, status = 200) {
  const body = JSON.stringify(value);
  response.writeHead(status, {
    "content-length": Buffer.byteLength(body),
    "content-type": "application/json",
  });
  response.end(body);
}
`;
