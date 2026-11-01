export const browserRedirectSource = `async function runRedirectSmoke() {
  const targetOrigin = new URLSearchParams(location.search).get("corsOrigin");
  assert(targetOrigin && targetOrigin !== location.origin, "Redirect fixture needs a second origin.");
  const secret = "FAKE-BROWSER-REVIEW-KEY";
  const blocked = await avirx(location.origin)
    .auth.apiKey("X-CUSTOM-TOKEN", () => secret)
    .get("/native/credential-redirect").result();
  assert(!blocked.ok, "Managed custom credentials must reject a redirect by default.");
  equal((await (await fetch(targetOrigin + "/credential-count")).json()).calls, 0,
    "The second origin must not receive the protected request.");

  const trusted = avirx(location.origin, { allowCredentialRedirects: true })
    .auth.apiKey("X-CUSTOM-TOKEN", () => secret).header("x-derived", "yes");
  const received = await trusted.get("/native/credential-redirect").json();
  equal(received.token, secret, "Explicit opt-in trusts the redirect destination.");
  equal((await (await fetch(targetOrigin + "/credential-count")).json()).calls, 1);

  const bearer = await avirx(location.origin).auth.bearer(() => "FAKE-BEARER")
    .get("/native/credential-redirect").json();
  equal(bearer.authorization, null, "Native fetch must strip cross-origin Authorization.");
  const ordinary = await avirx(location.origin).get("/native/credential-redirect").json();
  equal(ordinary.token, null, "Ordinary fetch redirects remain supported.");
}
`;
