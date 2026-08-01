import { afterEach, describe, expect, it, vi } from 'vitest';
import { avirx } from 'avirx';

describe('fetch execution', () => {
    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('downloads blob responses with metadata while preserving the native response body', async () => {
        const fetchImpl = vi.fn<typeof fetch>(async () =>
            Promise.resolve(new Response('id,name\n1,Ada\n', {
                headers: {
                    'content-disposition': 'attachment; filename="report.csv"',
                    'content-length': '14',
                    'content-type': 'text/csv',
                },
            })),
        );

        const download = await avirx('https://api.example.com', { fetch: fetchImpl })
            .get('/exports/{id}')
            .path({ id: 'exp_123' })
            .download();

        expect(download.status).toBe(200);
        expect(download.filename).toBe('report.csv');
        expect(download.contentLength).toBe(14);
        expect(download.contentType).toBe('text/csv');
        await expect(download.blob.text()).resolves.toBe('id,name\n1,Ada\n');
        await expect(download.response.native.text()).resolves.toBe('id,name\n1,Ada\n');
    });

    it('prefers UTF-8 filename-star content disposition metadata for downloads', async () => {
        const fetchImpl = vi.fn<typeof fetch>(async () =>
            Promise.resolve(new Response('ok', {
                headers: {
                    'content-disposition': 'attachment; filename=fallback.txt; filename*=UTF-8\'\'report%20final.csv',
                    'content-length': 'invalid',
                },
            })),
        );

        const download = await avirx('https://api.example.com', { fetch: fetchImpl })
            .get('/exports/latest')
            .download();

        expect(download.filename).toBe('report final.csv');
        expect(download.contentLength).toBeUndefined();
    });

    it('parses quoted download filenames with escaped characters', async () => {
        const fetchImpl = vi.fn<typeof fetch>(async () =>
            Promise.resolve(new Response('ok', {
                headers: {
                    'content-disposition': 'attachment; filename="quarterly; \\"final\\".csv"',
                },
            })),
        );

        const download = await avirx('https://api.example.com', { fetch: fetchImpl })
            .get('/exports/latest')
            .download();

        expect(download.filename).toBe('quarterly; "final".csv');
    });
});
