import { describe, expect, it } from 'vitest';
import { avirx } from 'avirx';

describe('HTTP method builders', () => {
    it('serializes URLSearchParams bodies in curl output', async () => {
        const body = new URLSearchParams([
            ['tag', 'a'],
            ['tag', 'b'],
            ['q', 'hello world'],
        ]);

        const curl = await avirx('https://api.example.com')
            .post('/events')
            .body(body)
            .curl();

        expect(curl).toBe(
            [
                'curl -X POST \'https://api.example.com/events\'',
                '  -d \'tag=a&tag=b&q=hello+world\'',
            ].join(' \\\n'),
        );
    });

    it('serializes text bodies in curl output', async () => {
        const curl = await avirx('https://api.example.com')
            .post('/events')
            .body('hello \'world\'')
            .curl();

        expect(curl).toBe(
            [
                'curl -X POST \'https://api.example.com/events\'',
                '  -d \'hello \'\\\'\'world\'\\\'\'\'',
            ].join(' \\\n'),
        );
    });

    it('documents omitted FormData bodies in curl output', async () => {
        const body = new FormData();
        body.set('name', 'avatar');

        const curl = await avirx('https://api.example.com')
            .post('/events')
            .body(body)
            .curl();

        expect(curl).toBe(
            [
                'curl -X POST \'https://api.example.com/events\'',
                '# Avirx omitted a FormData body because curl output cannot faithfully represent',
                '# runtime multipart boundaries.',
            ].join('\n'),
        );
    });

    it('documents omitted binary bodies in curl output', async () => {
        const curl = await avirx('https://api.example.com')
            .post('/events')
            .body(new ArrayBuffer(3))
            .curl();

        expect(curl).toBe(
            [
                'curl -X POST \'https://api.example.com/events\'',
                '# Avirx omitted a binary body (3 bytes).',
                '# Attach an equivalent file manually with --data-binary @file.',
            ].join('\n'),
        );
    });

    it('documents omitted stream bodies in curl output without consuming them', async () => {
        const body: ReadableStream<Uint8Array> = new ReadableStream();

        const curl = await avirx('https://api.example.com')
            .post('/events')
            .body(body)
            .curl();

        expect(curl).toBe(
            [
                'curl -X POST \'https://api.example.com/events\'',
                '# Avirx omitted a stream body because curl output cannot inspect it without consuming the stream.',
            ].join('\n'),
        );
    });
});
