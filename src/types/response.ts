import type { AvirxError } from '../error/avirx-error.js';
import type { AvirxHeaders } from './http.js';
import type { AvirxBuiltRequest } from './request.js';
import type { AvirxRetryEvent } from './retry.js';

export type AvirxTimingMetadata = Readonly<{
    durationMs?: number;
    endedAt?: number;
    retryEvents?: readonly AvirxRetryEvent[];
    startedAt?: number;
}>;

export type AvirxResponse<T = unknown> = Readonly<{
    data?: T;
    headers: AvirxHeaders;
    native: Response;
    ok: boolean;
    request: AvirxBuiltRequest;
    status: number;
    statusText: string;
    timing: AvirxTimingMetadata;
    url: string;
}>;

export type AvirxDownload = Readonly<{
    blob: Blob;
    contentLength?: number;
    contentType?: string;
    filename?: string;
    response: AvirxResponse;
    status: number;
}>;

export type AvirxResult<T, E = unknown> =
  | {
      ok: true;
      status: number;
      data: T;
      response: AvirxResponse<T>;
  }
  | {
      ok: false;
      status?: number;
      error: AvirxError<E>;
      response?: AvirxResponse<E>;
  };
