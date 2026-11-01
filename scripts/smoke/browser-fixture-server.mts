import { readFile } from 'node:fs/promises';
import { createServer, type Server, type ServerResponse } from 'node:http';
import { join } from 'node:path';
import { createCorsBrowserHandler } from './browser-cors-server.mts';
import { createNativeBrowserHandler } from './browser-native-server.mts';
import { browserRuntimeSource } from './browser-runtime-source.mts';

export type BrowserFixtureServer = Readonly<{
    close: () => Promise<void>;
    url: string;
}>;

export async function startBrowserFixtureServer(
    packageDirectory: string,
): Promise<BrowserFixtureServer> {
    const runtime = await readFile(
        join(packageDirectory, 'node_modules/avirx/dist/index.js'),
        'utf8',
    );
    const nativeHandler = createNativeBrowserHandler();
    let credentialTarget = '';
    const server = createServer((request, response) => {
        const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
        if (pathname === '/native/credential-redirect') {
            response.writeHead(302, { 'cache-control': 'no-store', location: credentialTarget }).end();
            return;
        }
        if (nativeHandler(request, response)) return;
        if (pathname === '/') {
            send(response, 'text/html; charset=utf-8', browserPage);
            return;
        }
        if (pathname === '/avirx.js') {
            send(response, 'text/javascript; charset=utf-8', runtime);
            return;
        }
        if (pathname === '/browser-runtime.js') {
            send(response, 'text/javascript; charset=utf-8', browserRuntimeSource);
            return;
        }
        response.writeHead(404).end();
    });
    const corsServer = createServer(createCorsBrowserHandler());
    try {
        await listen(server);
        await listen(corsServer);
    } catch (error) {
        if (server.listening) await close(server);
        if (corsServer.listening) await close(corsServer);
        throw error;
    }
    const address = server.address();
    const corsAddress = corsServer.address();
    if (address === null || typeof address === 'string'
        || corsAddress === null || typeof corsAddress === 'string') {
        await close(server);
        await close(corsServer);
        throw new Error('Browser fixture server did not bind to a TCP port.');
    }
    credentialTarget = `http://127.0.0.1:${String(corsAddress.port)}/credential-target`;
    return {
        async close() {
            await Promise.all([close(server), close(corsServer)]);
        },
        url: `http://127.0.0.1:${String(address.port)}/?corsOrigin=`
            + encodeURIComponent(`http://127.0.0.1:${String(corsAddress.port)}`),
    };
}

const browserPage = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Avirx browser smoke</title></head>
<body data-smoke-status="loading"><script type="module" src="/browser-runtime.js"></script></body>
</html>`;

function send(response: ServerResponse, contentType: string, body: string): void {
    response.writeHead(200, {
        'cache-control': 'no-store',
        'content-type': contentType,
    }).end(body);
}

async function listen(server: Server): Promise<void> {
    await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => {
            server.off('error', reject);
            resolve();
        });
    });
}

async function close(server: Server): Promise<void> {
    await new Promise<void>((resolve, reject) => {
        server.closeAllConnections();
        server.close((error) => {
            if (error === undefined) {
                resolve();
            } else {
                reject(error);
            }
        });
    });
}
