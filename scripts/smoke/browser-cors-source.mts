export const browserCorsSource = `async function runCorsSmoke() {
  const origin = new URLSearchParams(location.search).get("corsOrigin");
  assert(origin && origin !== location.origin, "CORS fixture must use a separate origin.");
  for (const pathname of ["/hidden", "/exposed"]) {
    const options = pathname === "/hidden"
      ? { ttl: "60s" }
      : { ttl: "60s", vary: ["accept", "accept-language"] };
    const client = avirx(origin).cache(options);
    const native = await fetch(origin + pathname, { headers: { "accept-language": "fr" } });
    equal(native.type, "cors");
    equal(native.headers.get("cache-control"), "public, max-age=0");
    equal(native.headers.get("vary"), pathname === "/hidden" ? null : "Accept-Language");
    await native.text();
    equal(await client.get(pathname).header("accept-language", "fr").text(), "fr");
    equal(await client.get(pathname).header("accept-language", "en").text(), "en");
    equal(client.state.cache.size(), 0,
      "CORS-filtered metadata is outside the built-in cache boundary, even with exposed Vary.");
  }
}
`;
