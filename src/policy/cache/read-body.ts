export async function readCacheBody(response: Response, limit: number): Promise<ArrayBuffer | undefined> {
    const reader = response.body?.getReader();
    if (!reader) {
        return new ArrayBuffer(0);
    }

    const chunks: Uint8Array[] = [];
    let bytes = 0;
    try {
        for (;;) {
            const next = await reader.read();
            if (next.done) {
                break;
            }
            bytes += next.value.byteLength;
            if (bytes > limit) {
                // A tee branch's cancellation can wait for the untouched native branch.
                void reader.cancel().catch(() => undefined);
                return undefined;
            }
            chunks.push(next.value);
        }
    } finally {
        reader.releaseLock();
    }

    const body = new Uint8Array(bytes);
    let offset = 0;
    for (const chunk of chunks) {
        body.set(chunk, offset);
        offset += chunk.byteLength;
    }
    return body.buffer;
}
