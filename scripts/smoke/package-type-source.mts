export const typeSmokeSource = `import { avirx, endpoint, type AvirxResult } from "avirx";

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
