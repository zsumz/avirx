import { describe, expect, it, vi } from 'vitest';
import { avirx, endpoint } from 'avirx';
import { publicResponse } from '../../helpers/public-response.js';

describe('cache clear during contract input validation', () => {
    it.each(['call', 'result'] as const)('invalidates an outstanding contract %s', async (terminal) => {
        let release!: () => void;
        let started!: () => void;
        const validationStarted: Promise<undefined> = new Promise((resolve) => {
            started = () => {
                resolve(undefined);
            };
        });
        const validationReleased: Promise<undefined> = new Promise((resolve) => {
            release = () => {
                resolve(undefined);
            };
        });
        let validations = 0;
        const params = {
            async parse(input: unknown): Promise<{ id: string }> {
                validations += 1;
                if (validations === 1) {
                    started();
                    await validationReleased;
                }
                return input as { id: string };
            },
        };
        const fetchImpl = vi.fn<typeof fetch>()
            .mockImplementationOnce(async () => Promise.resolve(publicResponse('"stale"')))
            .mockImplementation(async () => Promise.resolve(publicResponse('"fresh"')));
        const client = avirx('https://example.com', { fetch: fetchImpl }).cache({ ttl: '1s' });
        const api = client.contract({ getUser: endpoint.get('/users/{id}').params(params) });
        const input = { path: { id: '1' } };
        const pending = terminal === 'call' ? api.getUser(input) : api.getUser.result(input);
        await validationStarted;
        client.state.cache?.clear();
        release();

        const value = await pending;
        if (terminal === 'call') expect(value).toBe('stale');
        else expect(value).toMatchObject({ data: 'stale', ok: true });
        expect(client.state.cache?.size()).toBe(0);
        expect(await api.getUser(input)).toBe('fresh');
        expect(await api.getUser(input)).toBe('fresh');
        expect(fetchImpl).toHaveBeenCalledTimes(2);
    });
});
