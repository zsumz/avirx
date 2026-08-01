import { writeCacheResponse } from '../execution/cache.js';
import { executeExpectedRequest } from '../execution/execute-expected-request.js';
import { readBlobResponse } from './read-response.js';
import { createDownload } from './create-download.js';
import type { AvirxClientState, AvirxDownload, AvirxRequestState } from '../types.js';

export async function executeDownload(
    clientState: AvirxClientState,
    state: AvirxRequestState,
): Promise<AvirxDownload> {
    const response = await executeExpectedRequest(clientState, state);
    const blob = await readBlobResponse(response.native);
    await writeCacheResponse(clientState, response);
    return createDownload(response, blob);
}
