export const boundaryTypeSmokeSource = `import {
  avirx, endpoint, type AvirxRequestBuilder, type AvirxPathParamNames,
  type AvirxContractClient, type AvirxEndpointContract,
} from "avirx";

const client = avirx("https://api.example.test");
const plain: AvirxRequestBuilder = client.get("/users");
const templated: AvirxRequestBuilder = client.get("/users/{id}");
const writable: AvirxRequestBuilder = client.post("/users/{id}");
function withHeader(request: AvirxRequestBuilder): AvirxRequestBuilder {
  return request.header("x-shared", "supported");
}
withHeader(client.get("/users"));
withHeader(client.get("/users/{id}").path({ id: "123" }));
withHeader(client.post("/users").body({ name: "Example" }));
// @ts-expect-error Unknown properties must reject even with noUncheckedIndexedAccess disabled.
const unknownProperty = client.get("/users").notARequestMethod;
// @ts-expect-error Templated body-capable builders must reject unknown properties too.
const templatedUnknown = client.post("/users/{id}").notARequestMethod;
// @ts-expect-error GET bodies remain prohibited.
client.get("/users/{id}").body("invalid");
// @ts-expect-error HEAD multipart bodies remain prohibited.
client.head("/users/{id}").multipart();
// @ts-expect-error Pathless builders must reject path calls.
client.post("/users").path({});

// @ts-expect-error The reserved then key would create an accidental thenable.
client.contract({ then: endpoint.get("/unintended") });
const symbol = Symbol("endpoint");
const symbolContract = { [symbol]: endpoint.get("/unreachable") };
// @ts-expect-error Contract endpoint keys must be strings.
client.contract(symbolContract);
async function adoptContract(contract: AvirxContractClient<AvirxEndpointContract>): Promise<typeof contract> {
  // @ts-expect-error Broad contract views do not advertise unsupported symbol endpoints.
  void contract[symbol];
  return Promise.resolve(contract);
}

const extra = { parse: (input: unknown) => ({ id: "123", extra: true }) };
const asyncExtra = { parse: async (input: unknown) => ({ id: "123", extra: true }) };
const optionalExtra = { parse: (input: unknown): { id: string; extra?: string } => ({ id: "123" }) };
// @ts-expect-error Sync path schema outputs must have exactly the route's keys.
endpoint.get("/users/{id}").params(extra);
// @ts-expect-error Async path schema outputs must have exactly the route's keys.
endpoint.get("/users/{id}").params(asyncExtra);
// @ts-expect-error Optional extra output keys are also unsupported.
endpoint.get("/users/{id}").params(optionalExtra);
const api = client.contract({
  get: endpoint.get("/users/{id}").params({
    parse: async (input: { raw: number }) => ({ id: String(input.raw) }),
  }),
});
api.get({ path: { raw: 123 } });
const supportedName: AvirxPathParamNames<"/{v1.id}/{urn:id}/{用户}/{x-y}"> = "用户";
// @ts-expect-error URL separators cannot occur in parameter names.
const unsupportedName: AvirxPathParamNames<"/{a/b}"> = "a/b";

const explicitRedirects = avirx("https://api.example.test", { allowCredentialRedirects: true });
// @ts-expect-error Credential redirect opt-in must be boolean.
avirx("https://api.example.test", { allowCredentialRedirects: "yes" });

async function useAdvancedPolicyHandles(): Promise<void> {
  const policies = client.cache({ ttl: "1s" }).concurrency(1).rateLimit({ requests: 1, per: "1s" });
  const request = policies.get("/public");
  const built = await request.build();
  const cache = policies.state.cache;
  const concurrency = policies.state.concurrency;
  const rate = policies.state.rateLimit;
  if (cache) {
    cache.get(built);
    await cache.set(built, await request.send());
    cache.clear();
  }
  if (concurrency) {
    const release = await concurrency.acquire();
    try {
      await rate?.acquire(built);
    } finally {
      release();
    }
  }
}
void plain;
void templated;
void writable;
void unknownProperty;
void templatedUnknown;
void supportedName;
void unsupportedName;
void explicitRedirects;
void useAdvancedPolicyHandles;
void adoptContract;
`;
