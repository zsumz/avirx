#!/usr/bin/env node
/* global console, process */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const temp = await mkdtemp(join(tmpdir(), "avirx-browser-smoke-"));
const npmCache = join(temp, "npm-cache");
const fixture = join(temp, "fixture");

try {
  log("Building package");
  run("npm", ["run", "build"], { cwd: root });

  log("Packing package");
  const pack = run("npm", ["pack", "--pack-destination", temp, "--json"], { cwd: root });
  const [packed] = JSON.parse(pack.stdout);
  assert(packed && typeof packed.filename === "string", "npm pack did not report a tarball filename.");

  const tarball = join(temp, packed.filename);
  assert(existsSync(tarball), `Expected packed tarball at ${tarball}.`);

  await mkdir(fixture, { recursive: true });
  await writeJson(join(fixture, "package.json"), {
    private: true,
    type: "module",
    dependencies: {},
  });

  log("Installing packed tarball into browser fixture");
  run("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund", "--package-lock=false", tarball], {
    cwd: fixture,
    env: npmEnv(),
  });

  log("Scanning packed dist for Node runtime imports");
  await assertNoNodeRuntimeImports(join(fixture, "node_modules/avirx/dist"));

  await writeFile(join(fixture, "browser-runtime.mjs"), browserRuntimeSource(), "utf8");
  log("Running browser Web API compatibility fixture");
  run(process.execPath, ["browser-runtime.mjs"], { cwd: fixture });

  log("Browser compatibility smoke test passed");
} finally {
  await rm(temp, { force: true, recursive: true });
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: "utf8",
    env: options.env ?? process.env,
  });

  if (result.status !== 0) {
    const rendered = [result.stdout, result.stderr].filter(Boolean).join("\n");
    throw new Error(
      [
        `Command failed: ${command} ${args.join(" ")}`,
        `cwd: ${options.cwd ?? process.cwd()}`,
        rendered,
      ].filter(Boolean).join("\n"),
    );
  }

  return result;
}

function npmEnv() {
  return {
    ...process.env,
    npm_config_cache: npmCache,
  };
}

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function assertNoNodeRuntimeImports(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      await assertNoNodeRuntimeImports(path);
      continue;
    }

    if (!entry.isFile() || !entry.name.endsWith(".js")) {
      continue;
    }

    const source = await readFile(path, "utf8");
    const forbiddenPatterns = [
      /from\s+["']node:/u,
      /import\s*\(\s*["']node:/u,
      /require\s*\(\s*["']node:/u,
      /\bprocess\./u,
      /\bBuffer\./u,
    ];

    for (const pattern of forbiddenPatterns) {
      assert(!pattern.test(source), `Packed browser dist contains Node runtime usage in ${path}: ${pattern}`);
    }
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function log(message) {
  console.log(`[browser-smoke] ${message}`);
}

function browserRuntimeSource() {
  return `import assert from "node:assert/strict";
import { avirx, endpoint } from "avirx";

for (const name of ["fetch", "Headers", "Request", "Response", "URL", "FormData", "Blob"]) {
  assert.equal(typeof globalThis[name], "function", \`Expected browser Web API global \${name}\`);
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
    assert.equal(init.body, JSON.stringify({ ok: true }));
    assert.match(headers.get("content-type") ?? "", /application\\/json/u);
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
      assert.equal(typeof input.id, "string");
      assert.equal(typeof input.email, "string");
      return { id: input.id, email: input.email };
    },
  };

  const Params = {
    parse(input) {
      assert.equal(typeof input.id, "string");
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

  assert.equal(user.email, "browser@example.com");
  assert.equal(seen.at(-1).token, "Bearer browser-token");
  assert.equal(seen.at(-1).url.searchParams.get("include"), "profile");

  const form = new FormData();
  form.set("email", "browser@example.com");
  const formResponse = await api.post("/forms").body(form).expect(201).json();
  assert.deepEqual(formResponse, { ok: true, kind: "form" });

  const blob = new Blob([JSON.stringify({ ok: true })], { type: "application/json" });
  const blobResponse = await api.post("/blobs").body(blob).expect(201).json();
  assert.deepEqual(blobResponse, { ok: true, kind: "blob" });

  const params = new URLSearchParams([["q", "browser"]]);
  const paramsResponse = await api.post("/search").body(params).expect(201).json();
  assert.deepEqual(paramsResponse, { ok: true, kind: "url-search-params" });

  const jsonResponse = await api.post("/json").body({ ok: true }).expect(201).json();
  assert.deepEqual(jsonResponse, { ok: true });

  const built = await api.post("/blobs").body(blob).build();
  const browserRequest = new Request(built.url, {
    body: built.body,
    headers: built.headers,
    method: built.method,
  });
  assert.equal(browserRequest.method, "POST");
  assert.equal(browserRequest.headers.get("authorization"), "Bearer browser-token");

  const contractApi = avirx("https://api.example.test").contract({
    getUser: endpoint
      .get("/contracts/{id}")
      .params(Params)
      .returns(User),
  });

  const contractUser = await contractApi.getUser({ path: { id: "usr_123" } });
  assert.equal(contractUser.email, "contract@example.com");

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
`;
}
