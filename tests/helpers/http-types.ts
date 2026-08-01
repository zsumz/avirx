import type { IncomingHttpHeaders } from 'node:http';

export type HttpTestRequest = Readonly<{
    headers: IncomingHttpHeaders;
    method: string;
    rawBody: string;
    receivedAt: number;
    url: URL;
}>;

export type HttpTestResponse = Readonly<{
    body?: string;
    delayMs?: number;
    fail?: 'close';
    headers?: HeadersInit;
    status?: number;
    statusText?: string;
}>;

export type HttpTestRouteHandler = (
    request: HttpTestRequest,
) => HttpTestResponse | Promise<HttpTestResponse>;

export type HttpTestServer = Readonly<{
    close(): Promise<void>;
    origin: string;
    requests: readonly HttpTestRequest[];
    route(method: string, path: string, handler: HttpTestRouteHandler): void;
    url(path?: string): string;
}>;

export type HttpTestRouteKey = `${string} ${string}`;
