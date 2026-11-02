import { execFile, spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';
import { avirx } from 'avirx';
import { httpText, startHttpTestServer } from '../../helpers/http-server.js';

const curlAvailable = process.platform !== 'win32' && spawnSync('curl', ['--version']).status === 0;
const runFile = promisify(execFile);

describe('generated curl equivalence', () => {
    it('dispatches prototype-named headers supported by native fetch', async () => {
        const server = await startHttpTestServer();
        try {
            server.route('POST', '/', () => httpText('ok'));
            await avirx(server.origin).post('/').header('constructor', 'expected').text();
            const rawHeaders = server.requests[0]?.rawHeaders ?? [];
            const index = rawHeaders.indexOf('constructor');
            expect(index).toBeGreaterThanOrEqual(0);
            expect(rawHeaders[index + 1]).toBe('expected');
        } finally {
            await server.close();
        }
    });

    it.skipIf(!curlAvailable)('handles HEAD without waiting for the advertised GET body', async () => {
        const server = await startHttpTestServer();
        try {
            server.route('HEAD', '/', () => httpText('', { headers: { 'content-length': '17' } }));
            const request = avirx(server.origin).head('/');
            const response = await request.send();
            expect(response.status).toBe(200);
            const result = await runFile('/bin/sh', ['-c', await request.curl()], { timeout: 5000 });
            expect(result.stdout).toContain('content-length: 17');
            expect(server.requests.map(({ method }) => method)).toEqual(['HEAD', 'HEAD']);
        } finally {
            await server.close();
        }
    });

    it.skipIf(!curlAvailable)('sends bracketed route names literally', async () => {
        const server = await startHttpTestServer();
        try {
            server.route('POST', '/items/[1-2]', () => httpText('ok'));
            const request = avirx(server.origin).post('/items/[1-2]');
            await runFile('/bin/sh', ['-c', await request.curl()], { timeout: 5000 });
            expect(server.requests.map(({ url }) => url.pathname)).toEqual(['/items/[1-2]']);
        } finally {
            await server.close();
        }
    });

    it.skipIf(!curlAvailable)('preserves explicit empty headers without curl defaults', async () => {
        const server = await startHttpTestServer();
        try {
            server.route('POST', '/', () => httpText('ok'));
            const headers = { 'content-type': '', 'x-empty': '', accept: '', 'user-agent': '' };
            const request = avirx(server.origin).post('/').headers(headers).body('hello');
            await request.text();
            await runFile('/bin/sh', ['-c', await request.curl()], { timeout: 5000 });
            expect(server.requests).toHaveLength(2);
            for (const captured of server.requests) {
                expect(captured.headers).toMatchObject(headers);
                expect(captured.rawBody).toBe('hello');
            }
        } finally {
            await server.close();
        }
    });

    it.skipIf(!curlAvailable)('sends literal @ text and the same effective content type as fetch', async () => {
        const directory = await mkdtemp(join(tmpdir(), 'avirx-curl-'));
        const filename = join(directory, 'marker.txt');
        const server = await startHttpTestServer();
        try {
            await writeFile(filename, 'This file must never be uploaded.');
            server.route('POST', '/', () => httpText('ok'));
            const request = avirx(server.origin).post('/').body(`@${filename}`);
            await request.text();
            await runFile('/bin/sh', ['-c', await request.curl()], { timeout: 5000 });
            expect(server.requests).toHaveLength(2);
            expect(server.requests.map(({ rawBody }) => rawBody)).toEqual([`@${filename}`, `@${filename}`]);
            expect(server.requests.map(({ headers }) => headers['content-type']))
                .toEqual(['text/plain;charset=UTF-8', 'text/plain;charset=UTF-8']);
        } finally {
            await server.close();
            await rm(directory, { recursive: true, force: true });
        }
    });

    it.skipIf(!curlAvailable)('preserves multiline quoted text with an explicit content type', async () => {
        const server = await startHttpTestServer();
        try {
            server.route('POST', '/', () => httpText('ok'));
            const text = 'line one\nline \'two\'\r\n$literal `text`';
            const request = avirx(server.origin).post('/').header('content-type', 'application/custom').body(text);
            await request.text();
            await runFile('/bin/sh', ['-c', await request.curl()], { timeout: 5000 });
            expect(server.requests.map(({ rawBody }) => rawBody)).toEqual([text, text]);
            expect(server.requests.map(({ headers }) => headers['content-type']))
                .toEqual(['application/custom', 'application/custom']);
        } finally {
            await server.close();
        }
    });
});
