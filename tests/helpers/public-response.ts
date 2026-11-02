export function publicResponse(body?: BodyInit | null, init: ResponseInit = {}): Response {
    const headers = new Headers(init.headers);
    if (!headers.has('cache-control')) headers.set('cache-control', 'public');
    return new Response(body, { ...init, headers });
}
