import { describe, expect, it, vi } from 'vitest';
import { avirx, endpoint } from 'avirx';

describe('client contracts', () => {
    it('supports explicit result mode for contract calls', async () => {
        const fetchImpl = vi.fn<typeof fetch>(async () =>
            Promise.resolve(new Response(JSON.stringify({ code: 'missing' }), { status: 404 })),
        );
        const ParamsSchema = {
            parse(input: unknown): { id: string } {
                return input as { id: string };
            },
        };
        const UserSchema = {
            parse(input: unknown): { id: string } {
                return input as { id: string };
            },
        };
        const api = avirx('https://api.example.com', { fetch: fetchImpl }).contract({
            getUser: endpoint.get('/users/{id}').params(ParamsSchema).returns(UserSchema),
        });

        const result = await api.getUser.result({ path: { id: 'usr_missing' } });

        expect(result).toMatchObject({
            ok: false,
            status: 404,
        });
        if (result.ok) {
            throw new Error('Expected error result.');
        }
        expect(result.error.message).toBe('Unexpected HTTP status 404.');
    });
});
