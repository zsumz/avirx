import { describe, expect, it } from 'vitest';
import { avirx } from 'avirx';
import { createFetchInit } from '../../../src/execution/fetch-init.js';
import { bodyCases, createBodyTransition, expectBodyTransition } from '../../helpers/body-transitions.js';

describe('body replacement MIME ownership', () => {
    it('serializes every body transition with the final native MIME and payload', async () => {
        for (const source of bodyCases) {
            for (const target of bodyCases) {
                for (const explicit of [undefined, 'application/explicit', 'application/json', '']) {
                    for (const placement of ['client', 'before', 'between', 'after'] as const) {
                        const request = createBodyTransition(
                            'https://example.com', source, target, explicit, placement,
                        );
                        const built = await request.build();
                        const captured = new Request(built.url, createFetchInit(built, undefined));
                        expectBodyTransition(target, captured.headers.get('content-type') ?? undefined,
                            await captured.text(), explicit);
                    }
                }
            }
        }
    });

    it('keeps inferred JSON MIME out of state and handles multipart builder replacement', async () => {
        const original = avirx('https://example.com').post('/body').body({ ok: true });
        const form = original.multipart().field('x', 'value');
        expect(original.state.headers).toEqual({});
        expect(form.state.headers).toEqual({});
        expect((await original.build()).headers['content-type']).toBe('application/json');
        expect((await form.build()).headers['content-type']).toBeUndefined();
        expect((await form.body('hello').build()).headers['content-type']).toBeUndefined();
    });
});
