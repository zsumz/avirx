import { describe, expect, it, vi } from 'vitest';
import { avirx, type AvirxError } from 'avirx';

describe('result hook error boundaries', () => {
    describe.each(['send', 'json', 'text', 'download', 'as', 'result'] as const)('%s terminal', (terminal) => {
        it.each(['request', 'response', 'retry'] as const)('rejects a nested %s hook failure', async (event) => {
            let nestedError: AvirxError | undefined;
            const nested = avirx('https://nested.example.com', {
                fetch: vi.fn<typeof fetch>().mockRejectedValue(new Error('nested request failed')),
            }).on('error', (context) => {
                nestedError = context.error();
            });
            const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}', {
                status: event === 'retry' ? 503 : 200,
            }));

            const request = avirx('https://api.example.com', { fetch: fetchImpl })
                .get('/outer')
                .retry(1)
                .on(event, async () => {
                    await nested.get('/inner').send();
                });
            const execution = terminal === 'as' ? request.as({ parse: (value: unknown) => value })
                : terminal === 'json' ? request.json()
                    : terminal === 'result' ? request.result() : request[terminal]();
            const failure = await execution.catch((error: unknown) => error);

            expect(nestedError).toBeDefined();
            expect(failure).toBe(nestedError);
            expect(fetchImpl).toHaveBeenCalledTimes(event === 'request' ? 0 : 1);
        });
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

            const failure = await execution.catch((error: unknown) => error);
            expect(failure).toBe(rethrown);
            expect(rethrown).toBeDefined();
        },
    );
});
