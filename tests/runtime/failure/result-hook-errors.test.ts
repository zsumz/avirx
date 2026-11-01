import { describe, expect, it, vi } from 'vitest';
import { avirx, type AvirxError } from 'avirx';

describe('result hook error boundaries', () => {
    it.each(['response', 'retry'] as const)('returns a nested request failure from a %s hook', async (event) => {
        let nestedError: AvirxError | undefined;
        const nested = avirx('https://nested.example.com', {
            fetch: vi.fn<typeof fetch>().mockRejectedValue(new Error('nested request failed')),
        }).on('error', (context) => {
            nestedError = context.error();
        });
        const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}', {
            status: event === 'retry' ? 503 : 200,
        }));

        const result = await avirx('https://api.example.com', { fetch: fetchImpl })
            .get('/outer')
            .retry(1)
            .on(event, async () => {
                await nested.get('/inner').send();
            })
            .result();

        expect(nestedError).toBeDefined();
        expect(result.ok).toBe(false);
        if (result.ok) throw new Error('Expected error result.');
        expect(result.error).toBe(nestedError);
        expect(result.error.request.url.hostname).toBe('nested.example.com');
        expect(fetchImpl).toHaveBeenCalledOnce();
    });

    it.each(['transport', 'status', 'json', 'validation'] as const)(
        'preserves the result boundary when an error hook rethrows a %s failure',
        async (phase) => {
            let rethrown: AvirxError | undefined;
            const fetchImpl = vi.fn<typeof fetch>();
            if (phase === 'transport') {
                fetchImpl.mockRejectedValue(new Error('socket failed'));
            } else {
                fetchImpl.mockResolvedValue(new Response(phase === 'json' ? 'invalid JSON' : '{}', {
                    status: phase === 'status' ? 500 : 200,
                }));
            }
            const request = avirx('https://api.example.com', { fetch: fetchImpl })
                .get('/')
                .on('error', (context) => {
                    const error = context.error();
                    if (!error) throw new Error('Expected error hook context.');
                    rethrown = error;
                    throw error;
                });
            const schema = {
                parse(): never {
                    throw new Error('schema failed');
                },
            };
            const execution = phase === 'validation' ? request.result(schema) : request.result();

            if (phase === 'transport') {
                const result = await execution;
                expect(result.ok).toBe(false);
                if (result.ok) throw new Error('Expected error result.');
                expect(result.error).toBe(rethrown);
            } else {
                const failure = await execution.catch((error: unknown) => error);
                expect(failure).toBe(rethrown);
            }
            expect(rethrown).toBeDefined();
        },
    );
});
