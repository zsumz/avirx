export const typeSmokeSource = `import { avirx, endpoint, type AvirxResult, type AvirxSchema } from "avirx";

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
  health: endpoint.head("/health"),
});

const contractUserPromise: Promise<{ email: string; id: string }> = api.getUser({
  path: { id: "usr_123" },
});

// @ts-expect-error Packed types should reject invalid path input.
void api.getUser({ path: { id: 123 } });

const AsyncUser = {
  async parse(input: unknown): Promise<{ email: string; id: string }> {
    return input as { email: string; id: string };
  },
};
const asyncResult: Promise<AvirxResult<{ email: string; id: string }>> = client
  .get("/async-user")
  .result(AsyncUser);
const health: Promise<undefined> = api.health({});

const Page: AvirxSchema<{ page: number }, { page: string }> = {
  parse(input) {
    return { page: Number(input.page) };
  },
};
const transformed = client.contract({
  search: endpoint.get("/search").query(Page).returns(User),
});
const search: Promise<{ email: string; id: string }> = transformed.search({ query: { page: "2" } });
// @ts-expect-error Contract inputs use parser input, before transformation.
void transformed.search({ query: { page: 2 } });

const policies = client
  .cache({ ttl: "60s", maxEntries: 100, maxTotalBytes: 1_000_000 })
  .concurrency(2)
  .rateLimit({ requests: 10, per: "1s" });
const cacheBudget: number | undefined = policies.state.cache?.maxTotalBytes;
const cacheSize: number | undefined = policies.state.cache?.size();
const slot: Promise<() => void> | undefined = policies.state.concurrency?.acquire();
const rateStarts: number | undefined = policies.state.rateLimit?.starts();
policies.state.cache?.clear();

void userPromise;
void resultPromise;
void contractUserPromise;
void asyncResult;
void health;
void search;
void cacheBudget;
void cacheSize;
void slot;
void rateStarts;
`;
