import { afterEach, describe, expect, it, vi } from 'vitest';
import { avirx, endpoint } from 'avirx';

describe('cache policy', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it('does not cache unexpected statuses or validation failures', async () => {
        const schema = {
            parse(input: unknown): { id: string } {
                if (typeof input === 'object' && input !== null && 'id' in input) {
                    return input as { id: string };
                }
                throw new Error('invalid');
            },
        };
        const fetchImpl = vi
            .fn<typeof fetch>()
            .mockResolvedValueOnce(new Response('server error', { status: 500 }))
            .mockResolvedValueOnce(new Response(JSON.stringify({ nope: true })))
            .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'usr_123' })));
        const client = avirx('https://api.example.com', { fetch: fetchImpl }).cache({ ttl: '1s' });

        const result = await client.get('/users/usr_123').result();
        await expect(client.get('/users/usr_123').as(schema)).rejects.toThrow('Response validation failed.');
        await expect(client.get('/users/usr_123').as(schema)).resolves.toEqual({ id: 'usr_123' });

        expect(result.ok).toBe(false);
        expect(fetchImpl).toHaveBeenCalledTimes(3);
    });

    it('expires entries after ttl', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(0);
        const fetchImpl = vi
            .fn<typeof fetch>()
            .mockResolvedValueOnce(new Response('first'))
            .mockResolvedValueOnce(new Response('second'));
        const client = avirx('https://api.example.com', { fetch: fetchImpl }).cache({ ttl: '100ms' });

        await expect(client.get('/feature-flags').text()).resolves.toBe('first');
        await vi.advanceTimersByTimeAsync(99);
        await expect(client.get('/feature-flags').text()).resolves.toBe('first');
        await vi.advanceTimersByTimeAsync(1);
        await expect(client.get('/feature-flags').text()).resolves.toBe('second');

        expect(fetchImpl).toHaveBeenCalledTimes(2);
    });

    it('does not consume rate-limit budget or hooks for cache hits', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(0);
        const events: string[] = [];
        const fetchImpl = vi.fn<typeof fetch>(async () => Promise.resolve(new Response('ok')));
        const client = avirx('https://api.example.com', { fetch: fetchImpl })
            .cache({ ttl: '1s' })
            .rateLimit({ per: '1s', requests: 1 })
            .on('request', () => {
                events.push('request');
            })
            .on('response', () => {
                events.push('response');
            });

        await expect(client.get('/reference-data').text()).resolves.toBe('ok');
        const second = client.get('/reference-data').text();
        await vi.advanceTimersByTimeAsync(0);

        await expect(second).resolves.toBe('ok');
        expect(fetchImpl).toHaveBeenCalledOnce();
        expect(client.state.rateLimit?.starts()).toBe(1);
        expect(events).toEqual(['request', 'response']);
    });

    it('caches contract calls through the same policy', async () => {
        const fetchImpl = vi.fn<typeof fetch>(async () =>
            Promise.resolve(new Response(JSON.stringify({ id: 'usr_123' }))),
        );
        const User = {
            parse(input: unknown): { id: string } {
                return input as { id: string };
            },
        };
        const Params = {
            parse(input: unknown): { id: string } {
                return input as { id: string };
            },
        };
        const api = avirx('https://api.example.com', { fetch: fetchImpl })
            .cache({ ttl: '1s' })
            .contract({
                getUser: endpoint.get('/users/{id}').params(Params).returns(User),
            });

        await expect(api.getUser({ path: { id: 'usr_123' } })).resolves.toEqual({ id: 'usr_123' });
        await expect(api.getUser({ path: { id: 'usr_123' } })).resolves.toEqual({ id: 'usr_123' });

        expect(fetchImpl).toHaveBeenCalledOnce();
    });
});
