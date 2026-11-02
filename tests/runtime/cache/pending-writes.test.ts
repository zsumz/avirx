import { describe, expect, it } from 'vitest';
import { avirx } from 'avirx';
import { writeCacheResponse } from '../../../src/execution/cache.js';
import { createAvirxResponse } from '../../../src/response/create-response.js';
import { createCachePolicy } from '../../../src/policy/cache/cache.js';
import { publicResponse } from '../../helpers/public-response.js';

describe('cache writes', () => {
    it('allows an explicit set after clear to start a new write', async () => {
        const client = avirx('https://example.com', {
            fetch: async () => Promise.resolve(publicResponse('catalog')),
        }).cache({ ttl: '1s' });
        const response = await client.get('/catalog').send();
        client.state.cache?.clear();
        await client.state.cache?.set(response.request, response);

        const cached = client.state.cache?.get(response.request);
        expect(await cached?.native.text()).toBe('catalog');
        expect(client.state.cache?.size()).toBe(1);
    });

    it('does not repopulate storage when cleared while a write is pending', async () => {
        const cache = createCachePolicy({ ttl: '1s' });
        const request = await avirx('https://example.com').get('/catalog').build();
        let controller!: ReadableStreamDefaultController<Uint8Array>;
        const stream: ReadableStream<Uint8Array> = new ReadableStream({
            start(value) {
                controller = value;
            },
        });
        const native = publicResponse(stream);
        const response = createAvirxResponse(native, request, {});
        const write = cache.set(request, response);
        cache.clear();
        controller.enqueue(new TextEncoder().encode('catalog'));
        controller.close();
        await write;
        expect(cache.size()).toBe(0);
        await native.body?.cancel();
    });

    it('does not commit an automatic write cleared while copying its body', async () => {
        let controller!: ReadableStreamDefaultController<Uint8Array>;
        const stream: ReadableStream<Uint8Array> = new ReadableStream({
            start(value) {
                controller = value;
            },
        });
        const client = avirx('https://example.com', {
            fetch: async () => Promise.resolve(publicResponse(stream)),
        }).cache({ ttl: '1s' });
        const response = await client.get('/catalog').send();
        const write = writeCacheResponse(client.state, response);
        client.state.cache?.clear();
        controller.enqueue(new TextEncoder().encode('catalog'));
        controller.close();
        await write;

        expect(client.state.cache?.size()).toBe(0);
        await response.native.body?.cancel();
    });

    it('stops cache reads at the total budget without waiting for stream completion', async () => {
        const cache = createCachePolicy({ maxTotalBytes: 2, ttl: '1s' });
        const request = await avirx('https://example.com').get('/catalog').build();
        let controller!: ReadableStreamDefaultController<Uint8Array>;
        const stream: ReadableStream<Uint8Array> = new ReadableStream({
            start(value) {
                controller = value;
            },
        });
        const native = publicResponse(stream);
        const response = createAvirxResponse(native, request, {});
        const write = cache.set(request, response);
        controller.enqueue(new TextEncoder().encode('oversize'));
        await write;
        expect(cache.size()).toBe(0);
        controller.close();
        await native.body?.cancel();
    });
});
