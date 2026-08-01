import { parseContentDispositionFilename } from './content-disposition.js';
import { parseContentLength } from './content-length.js';
import type { AvirxDownload, AvirxResponse } from '../types.js';

export function createDownload(response: AvirxResponse, blob: Blob): AvirxDownload {
    const download: {
        blob: Blob;
        contentLength?: number;
        contentType?: string;
        filename?: string;
        response: AvirxResponse;
        status: number;
    } = {
        blob,
        response,
        status: response.status,
    };

    const contentType = response.headers['content-type'] ?? blob.type;
    if (contentType) {
        download.contentType = contentType;
    }

    const contentLength = parseContentLength(response.headers['content-length']);
    if (contentLength !== undefined) {
        download.contentLength = contentLength;
    }

    const filename = parseContentDispositionFilename(response.headers['content-disposition']);
    if (filename !== undefined) {
        download.filename = filename;
    }

    return Object.freeze(download);
}
