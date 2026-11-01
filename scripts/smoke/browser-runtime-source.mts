import { browserAssertionsSource } from './browser-assertions-source.mts';
import { browserNativeSource } from './browser-native-source.mts';

export const browserRuntimeSource = `import { avirx, endpoint } from "/avirx.js";
${browserAssertionsSource}
${browserNativeSource}
document.body.dataset.smokeStatus = "running";

try {
  await runSmoke();
  document.body.dataset.smokeStatus = "passed";
} catch (error) {
  document.body.dataset.smokeStatus = "failed";
  document.body.dataset.smokeMessage = errorMessage(error);
}

async function runSmoke() {
await runNativeSmoke();
for (const name of ["fetch", "Headers", "Request", "Response", "URL", "FormData", "Blob"]) {
  equal(typeof globalThis[name], "function", \`Expected browser Web API global \${name}\`);
}

const seen = [];
const previousFetch = globalThis.fetch;
globalThis.fetch = async (input, init = {}) => {
  assert(input instanceof URL, "Avirx should pass URL values accepted by browser fetch.");

  const request = new Request(input, init);
  const headers = new Headers(init.headers);
  seen.push({
    body: init.body,
    contentType: headers.get("content-type"),
    method: request.method,
    token: headers.get("authorization"),
    url: new URL(request.url),
  });

  if (request.url.includes("/users/usr%20123")) {
    return json({ id: "usr 123", email: "browser@example.com" });
  }

  if (request.url.includes("/forms")) {
    assert(init.body instanceof FormData, "FormData bodies should reach fetch unchanged.");
    return json({ ok: true, kind: "form" }, 201);
  }

  if (request.url.includes("/blobs")) {
    assert(init.body instanceof Blob, "Blob bodies should reach fetch unchanged.");
    return json({ ok: true, kind: "blob" }, 201);
  }

  if (request.url.includes("/search")) {
    assert(init.body instanceof URLSearchParams, "URLSearchParams bodies should reach fetch unchanged.");
    return json({ ok: true, kind: "url-search-params" }, 201);
  }

  if (request.url.includes("/json")) {
    equal(init.body, JSON.stringify({ ok: true }));
    match(headers.get("content-type") ?? "", /application\\/json/u);
    return json({ ok: true }, 201);
  }

  if (request.url.includes("/contracts/usr_123")) {
    return json({ id: "usr_123", email: "contract@example.com" });
  }

  return json({ code: "missing" }, 404);
};

try {
  const User = {
    parse(input) {
      equal(typeof input.id, "string");
      equal(typeof input.email, "string");
      return { id: input.id, email: input.email };
    },
  };

  const Params = {
    parse(input) {
      equal(typeof input.id, "string");
      return { id: input.id };
    },
  };

  const api = avirx("https://api.example.test")
    .auth.bearer(() => "browser-token")
    .headers(new Headers([["x-client", "browser-smoke"]]))
    .concurrency(2)
    .rateLimit({ requests: 20, per: "1s" });

  const user = await api
    .get("/users/{id}")
    .path({ id: "usr 123" })
    .query(new URLSearchParams([["include", "profile"]]))
    .as(User);

  equal(user.email, "browser@example.com");
  equal(seen.at(-1).token, "Bearer browser-token");
  equal(seen.at(-1).url.searchParams.get("include"), "profile");

  const form = new FormData();
  form.set("email", "browser@example.com");
  const formResponse = await api.post("/forms").body(form).expect(201).json();
  deepEqual(formResponse, { ok: true, kind: "form" });

  const blob = new Blob([JSON.stringify({ ok: true })], { type: "application/json" });
  const blobResponse = await api.post("/blobs").body(blob).expect(201).json();
  deepEqual(blobResponse, { ok: true, kind: "blob" });

  const params = new URLSearchParams([["q", "browser"]]);
  const paramsResponse = await api.post("/search").body(params).expect(201).json();
  deepEqual(paramsResponse, { ok: true, kind: "url-search-params" });

  const jsonResponse = await api.post("/json").body({ ok: true }).expect(201).json();
  deepEqual(jsonResponse, { ok: true });

  const built = await api.post("/blobs").body(blob).build();
  const browserRequest = new Request(built.url, {
    body: built.body,
    headers: built.headers,
    method: built.method,
  });
  equal(browserRequest.method, "POST");
  equal(browserRequest.headers.get("authorization"), "Bearer browser-token");

  const contractApi = avirx("https://api.example.test").contract({
    getUser: endpoint
      .get("/contracts/{id}")
      .params(Params)
      .returns(User),
  });

  const contractUser = await contractApi.getUser({ path: { id: "usr_123" } });
  equal(contractUser.email, "contract@example.com");

  assert(seen.some((call) => call.body instanceof FormData));
  assert(seen.some((call) => call.body instanceof Blob));
  assert(seen.some((call) => call.body instanceof URLSearchParams));
} finally {
  globalThis.fetch = previousFetch;
}
function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    headers: { "content-type": "application/json" },
    status,
  });
}
}
`;
