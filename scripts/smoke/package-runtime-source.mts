export const runtimeSmokeSource = `import assert from "node:assert/strict";
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
