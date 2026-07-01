import { describe, expect, it } from 'vitest';

import { runContractExample } from '../../examples/contract.js';
import { runCurlExample } from '../../examples/curl.js';
import { runProductionExample } from '../../examples/production.js';
import { runResultExample } from '../../examples/result.js';
import { runSchemaExample } from '../../examples/schema.js';
import { runSimpleExample } from '../../examples/simple.js';
import { runZodExample, runZodResultExample } from '../../examples/zod.js';

describe('examples', () => {
    it('runs the simple request example', async () => {
        await expect(runSimpleExample()).resolves.toMatchObject({
            items: [
                { id: 'book_123', title: 'The Left Hand of Darkness' },
                { id: 'book_456', title: 'Pattern Recognition' },
            ],
            shelf: 'featured',
        });
    });

    it('runs the schema example', async () => {
        await expect(runSchemaExample()).resolves.toEqual({
            id: 'book_123',
            title: 'The Left Hand of Darkness',
        });
    });

    it('runs the Zod example', async () => {
        await expect(runZodExample()).resolves.toEqual({
            id: 'book_123',
            title: 'The Left Hand of Darkness',
        });
    });

    it('runs the Zod result example', async () => {
        await expect(runZodResultExample()).resolves.toEqual({
            errorCode: 'missing',
            ok: false,
            status: 404,
        });
    });

    it('runs the result example', async () => {
        const result = await runResultExample();

        expect(result).toMatchObject({
            ok: false,
            status: 404,
        });
    });

    it('runs the contract example', async () => {
        await expect(runContractExample()).resolves.toEqual({
            id: 'book_456',
            title: 'Pattern Recognition',
        });
    });

    it('runs the curl example', async () => {
        await expect(runCurlExample()).resolves.toContain(
            'curl -X POST \'https://api.example.test/books\'',
        );
    });

    it('runs the production dogfood example', async () => {
        await expect(runProductionExample()).resolves.toEqual({
            authenticatedBook: {
                id: 'book_123',
                title: 'The Left Hand of Darkness',
            },
            cacheFetches: 1,
            cachedBook: {
                id: 'book_cache',
                title: 'A Wizard of Earthsea',
            },
            cancellation: {
                message: 'Request aborted.',
                ok: false,
            },
            contractBook: {
                id: 'book_456',
                title: 'Pattern Recognition',
            },
            unauthorized: {
                code: 'unauthorized',
                ok: false,
                status: 401,
            },
        });
    });
});
