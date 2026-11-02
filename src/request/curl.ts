import type { AvirxBuiltRequest, AvirxCurlOptions, AvirxHeaders } from '../types.js';

export function formatCurl(request: AvirxBuiltRequest, options: AvirxCurlOptions = {}): string {
    const redacted = options.redacted !== false;
    const headers = { ...redacted ? request.redactedHeaders : request.headers };
    const body = request.body;
    if ((typeof body === 'string' || body instanceof URLSearchParams)
        && headers['content-type'] === undefined && request.bodyMetadata.contentType) {
        headers['content-type'] = request.bodyMetadata.contentType;
    }
    const url = redacted ? request.redactedUrl : request.url;
    const method = request.method === 'HEAD' ? '--head' : `-X ${request.method}`;
    const globoff = ['[', ']', '{', '}'].some((character) => url.href.includes(character)) ? ' --globoff' : '';
    const parts = [`curl${globoff} ${method} ${quoteShell(url.href)}`];
    const comments: string[] = [];

    for (const [name, value] of sortedHeaders(headers)) {
        parts.push(`  -H ${quoteShell(value === '' ? `${name};` : `${name}: ${value}`)}`);
    }

    if (typeof body === 'string' && body.includes('\0')) {
        comments.push('# Avirx omitted a text body containing NUL because shell arguments cannot represent it.');
    } else if (typeof body === 'string') {
        parts.push(`  --data-raw ${quoteShell(body)}`);
    } else if (body instanceof URLSearchParams) {
        parts.push(`  --data-raw ${quoteShell(body.toString())}`);
    } else if ('body' in request && request.body !== null && request.body !== undefined) {
        comments.push(formatBodyOmissionComment(request));
    }

    const command = parts.join(' \\\n');
    return comments.length === 0 ? command : `${command}\n${comments.join('\n')}`;
}

function sortedHeaders(headers: AvirxHeaders): ReadonlyArray<[string, string]> {
    return Object.entries(headers).sort(([left], [right]) => left.localeCompare(right));
}

function quoteShell(value: string): string {
    return `'${value.replace(/'/gu, '\'\\\'\'')}'`;
}

function formatBodyOmissionComment(request: AvirxBuiltRequest): string {
    switch (request.bodyMetadata.kind) {
        case 'none':
            return '# Avirx omitted an empty body.';
        case 'json':
            return [
                '# Avirx omitted a JSON body because it cannot be represented',
                '# as inline curl data without changing runtime serialization.',
            ].join('\n');
        case 'text':
            return '# Avirx omitted a text body because curl output cannot inspect it without consuming the body.';
        case 'url-search-params':
            return '# Avirx omitted a URLSearchParams body because it was not available as inline curl data.';
        case 'form':
            return [
                '# Avirx omitted a FormData body because curl output cannot faithfully represent',
                '# runtime multipart boundaries.',
            ].join('\n');
        case 'binary':
            return [
                `# Avirx omitted a binary body${formatContentLength(request.bodyMetadata.contentLength)}.`,
                '# Attach an equivalent file manually with --data-binary @file.',
            ].join('\n');
        case 'stream':
            return '# Avirx omitted a stream body because curl output cannot inspect it without consuming the stream.';
    }
}

function formatContentLength(contentLength: number | undefined): string {
    return contentLength === undefined ? '' : ` (${String(contentLength)} bytes)`;
}
