import { describe, it } from 'vitest';
import { bodyCases, createBodyTransition, expectBodyTransition } from '../../helpers/body-transitions.js';
import { httpText, startHttpTestServer } from '../../helpers/http-server.js';

describe('real HTTP body replacement', () => {
    it('preserves final payloads and inferred or explicit MIME across the body cross product', async () => {
        const server = await startHttpTestServer();
        try {
            server.route('POST', '/body', () => httpText('ok'));
            for (const source of bodyCases) {
                for (const target of bodyCases) {
                    for (const explicit of [undefined, 'application/json', '']) {
                        await createBodyTransition(server.origin, source, target, explicit).text();
                        const captured = server.requests.at(-1);
                        if (!captured) throw new Error('Expected captured HTTP request.');
                        expectBodyTransition(target, captured.headers['content-type'], captured.rawBody, explicit);
                    }
                }
            }
        } finally {
            await server.close();
        }
    });
});
