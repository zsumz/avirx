#!/usr/bin/env node
/* global console, process */
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const temp = await mkdtemp(join(tmpdir(), "avirx-package-smoke-"));
const npmCache = join(temp, "npm-cache");
const fixture = join(temp, "fixture");

try {
  log("Building package");
  run("npm", ["run", "build"], { cwd: root });

  log("Packing package");
  const pack = run("npm", ["pack", "--pack-destination", temp, "--json"], { cwd: root, env: npmEnv() });
  const [packed] = JSON.parse(pack.stdout);
  assert(packed && typeof packed.filename === "string", "npm pack did not report a tarball filename.");
  assert(Array.isArray(packed.files), "npm pack did not report packed files.");

  const packedFiles = new Set(packed.files.map((file) => file.path));
  for (const file of packed.files) {
    assert(!file.path.endsWith(".map"), `Packed package should not include source map ${file.path}.`);
  }

  for (const path of [
    "package.json",
    "README.md",
    "LICENSE",
    "avirx-logo.svg",
    "dist/index.js",
    "dist/index.d.ts",
    "dist/client.js",
    "dist/request-builder.js",
    "dist/contract.js",
    "dist/endpoint.js",
  ]) {
    assert(packedFiles.has(path), `Packed package is missing ${path}.`);
  }

  const tarball = join(temp, packed.filename);
  assert(existsSync(tarball), `Expected packed tarball at ${tarball}.`);

  await mkdir(fixture, { recursive: true });
  await writeJson(join(fixture, "package.json"), {
    private: true,
    type: "module",
    dependencies: {},
  });

  log("Installing packed tarball into fixture");
  run("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund", "--package-lock=false", tarball], {
    cwd: fixture,
    env: npmEnv(),
  });

  for (const path of [
    "node_modules/avirx/package.json",
    "node_modules/avirx/LICENSE",
    "node_modules/avirx/dist/index.js",
    "node_modules/avirx/dist/index.d.ts",
  ]) {
    assert(existsSync(join(fixture, path)), `Installed package is missing ${path}.`);
  }

  for (const path of packed.files.map((file) => file.path)) {
    if (path.endsWith(".js") || path.endsWith(".d.ts")) {
      const source = await readFile(join(fixture, "node_modules/avirx", path), "utf8");
      assert(!source.includes("sourceMappingURL="), `Packed package should not reference source maps from ${path}.`);
    }
  }

  await writeFile(join(fixture, "runtime.mjs"), runtimeSmokeSource(), "utf8");
  log("Verifying ESM runtime import and request builder behavior");
  run(process.execPath, ["runtime.mjs"], { cwd: fixture });

  await writeFile(join(fixture, "types.ts"), typeSmokeSource(), "utf8");
  await writeJson(join(fixture, "tsconfig.json"), {
    compilerOptions: {
      exactOptionalPropertyTypes: true,
      lib: ["ESNext", "DOM"],
      module: "NodeNext",
      moduleResolution: "NodeNext",
      noEmit: true,
      strict: true,
      target: "ES2022",
      types: [],
    },
    include: ["types.ts"],
  });

  log("Verifying TypeScript types from packed artifact");
  run(process.execPath, [join(root, "node_modules/typescript/bin/tsc"), "-p", "tsconfig.json", "--pretty", "false"], {
    cwd: fixture,
  });

  log("Package smoke test passed");
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

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function log(message) {
  console.log(`[package-smoke] ${message}`);
}

function runtimeSmokeSource() {
  return `import assert from "node:assert/strict";
import { avirx, endpoint } from "avirx";

const calls = [];
const fetchImpl = async (input, init) => {
  const url = new URL(String(input));
  calls.push({ body: init?.body, method: init?.method, url: url.href });

  if (url.pathname === "/users/usr_123") {
    return new Response(JSON.stringify({ id: "usr_123", email: "a@example.com" }), {
      headers: { "content-type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ code: "missing" }), { status: 404 });
};

const User = {
  parse(input) {
    assert.equal(typeof input.id, "string");
    assert.equal(typeof input.email, "string");
    return input;
  },
};

const user = await avirx("https://api.example.test", { fetch: fetchImpl })
  .get("/users/{id}")
  .path({ id: "usr_123" })
  .query({ include: ["teams", "roles"] })
  .as(User);

assert.equal(user.email, "a@example.com");
assert.equal(calls[0].url, "https://api.example.test/users/usr_123?include=teams&include=roles");

const api = avirx("https://api.example.test", { fetch: fetchImpl }).contract({
  getUser: endpoint.get("/users/{id}").params({
    parse(input) {
      return input;
    },
  }).returns(User),
});

const contractUser = await api.getUser({ path: { id: "usr_123" } });
assert.equal(contractUser.id, "usr_123");
`;
}

function typeSmokeSource() {
  return `import { avirx, endpoint, type AvirxResult } from "avirx";

const Params = {
  parse(input: unknown): { id: string } {
    return input as { id: string };
  },
};

const User = {
  parse(input: unknown): { email: string; id: string } {
    return input as { email: string; id: string };
  },
};

const ErrorBody = {
  parse(input: unknown): { code: string } {
    return input as { code: string };
  },
};

const client = avirx("https://api.example.test");
const userPromise: Promise<{ email: string; id: string }> = client
  .get("/users/{id}")
  .path({ id: "usr_123" })
  .error(ErrorBody)
  .as(User);

const resultPromise: Promise<AvirxResult<{ email: string; id: string }, { code: string }>> = client
  .get("/users/{id}")
  .path({ id: "usr_123" })
  .error(ErrorBody)
  .result(User);

const api = client.contract({
  getUser: endpoint.get("/users/{id}").params(Params).returns(User),
});

const contractUserPromise: Promise<{ email: string; id: string }> = api.getUser({
  path: { id: "usr_123" },
});

// @ts-expect-error Packed types should reject invalid path input.
void api.getUser({ path: { id: 123 } });

void userPromise;
void resultPromise;
void contractUserPromise;
`;
}
