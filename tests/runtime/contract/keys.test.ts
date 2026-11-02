import { describe, expect, it, vi } from 'vitest';
import { avirx, endpoint } from 'avirx';

describe('contract endpoint keys', () => {
    it('rejects then endpoints before Promise adoption can execute a request', async () => {
        const fetchImpl = vi.fn<typeof fetch>(async () => Promise.resolve(new Response('{}')));
        const client = avirx('https://api.example.com', { fetch: fetchImpl });
        const createContract = client.contract as (contract: object) => unknown;
        const definition = endpoint.post('/unintended');

        await expect(Promise.resolve().then(() => createContract({ then: definition }))).rejects.toThrow(
            'Contract endpoint name "then" is reserved.',
        );
        expect(() => createContract(Object.defineProperty({}, 'then', { value: definition }))).toThrow(
            'Contract endpoint name "then" is reserved.',
        );
        expect(() => createContract(Object.create({ then: definition }) as object)).toThrow(
            'Contract endpoint name "then" is reserved.',
        );
        expect(fetchImpl).not.toHaveBeenCalled();
    });

    it('rejects enumerable and non-enumerable symbol endpoints instead of omitting them', () => {
        const fetchImpl = vi.fn<typeof fetch>(async () => Promise.resolve(new Response('{}')));
        const client = avirx('https://api.example.com', { fetch: fetchImpl });
        const createContract = client.contract as (contract: object) => unknown;
        const key = Symbol('endpoint');
        const definition = endpoint.get('/unreachable');

        for (const contract of [{ [key]: definition }, Object.defineProperty({}, key, { value: definition })]) {
            expect(() => createContract(contract)).toThrow('Contract endpoint names must be strings.');
        }
        expect(fetchImpl).not.toHaveBeenCalled();
    });

    it('preserves non-enumerable own string endpoints', async () => {
        const fetchImpl = vi.fn<typeof fetch>(async () => Promise.resolve(new Response('{"reachable":true}')));
        const definition = endpoint.get('/hidden');
        const contract = Object.defineProperty({}, 'hidden', { value: definition }) as {
            hidden: typeof definition;
        };
        const api = avirx('https://api.example.com', { fetch: fetchImpl }).contract(contract);

        await expect(api.hidden({})).resolves.toEqual({ reachable: true });
        expect(Object.hasOwn(api, 'hidden')).toBe(true);
        expect(fetchImpl).toHaveBeenCalledOnce();
    });

    it('retains preflight runtime validation for type-erased parser output with extra keys', async () => {
        const fetchImpl = vi.fn<typeof fetch>(async () => Promise.resolve(new Response('{}')));
        const api = avirx('https://api.example.com', { fetch: fetchImpl }).contract({
            get: endpoint.get('/users/{id}').params({
                parse: async () => Promise.resolve({ id: '123', extra: 'unsupported' }),
            } as never),
        });

        await expect(api.get({ path: { id: '123' } } as never)).rejects.toThrow(
            'Unexpected contract path params for "/users/{id}": extra.',
        );
        expect(fetchImpl).not.toHaveBeenCalled();
    });
});
