export const browserNativeSource = `async function runNativeSmoke() {
  const api = avirx(location.origin).cache({ ttl: "60s" });
  await fetch("/native/login?user=alice");
  equal((await api.get("/native/private").json()).user, "alice");
  await fetch("/native/login?user=bob");
  equal((await api.get("/native/private").json()).user, "bob",
    "A no-store response must not cross cookie sessions.");
  equal(api.state.cache.size(), 0);

  const first = await api.get("/native/public").json();
  const cached = await api.get("/native/public").json();
  equal(cached.calls, first.calls, "Explicitly public reference data should cache.");
  api.state.cache.clear();
  assert((await api.get("/native/public").json()).calls > first.calls);

  for (const combined of ["timeout", "client-request"]) {
    const controller = new AbortController();
    const client = avirx(location.origin).signal(controller.signal);
    const request = combined === "timeout"
      ? client.get("/native/stream").timeout("5s")
      : client.get("/native/stream").signal(new AbortController().signal);
    const response = await request.send();
    const reader = response.native.body.getReader();
    assert(!(await reader.read()).done);
    controller.abort(new Error("Browser consumer cancelled."));
    let rejected = false;
    try { await reader.read(); } catch { rejected = true; }
    assert(rejected, "Composed abort must cancel the native body after headers.");
    reader.releaseLock();
  }

  const response = await api.get("/native/stream").send();
  const reader = response.native.body.getReader();
  assert(!(await reader.read()).done, "Cached clients must expose open streams immediately.");
  await reader.cancel();
  reader.releaseLock();
}
`;
