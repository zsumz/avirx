export type AvirxBodyValue =
  | ArrayBuffer
  | Blob
  | FormData
  | ReadableStream<Uint8Array>
  | URLSearchParams
  | string
  | null
  | undefined
  | Record<string, unknown>
  | readonly unknown[];

export type AvirxMultipartFieldValue = boolean | number | string;

export type AvirxMultipartFileValue = Blob;

export type AvirxBodyMetadata = Readonly<{
    contentLength?: number;
    contentType?: string;
    kind: 'binary' | 'form' | 'json' | 'none' | 'stream' | 'text' | 'url-search-params';
}>;
