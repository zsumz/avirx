export type HttpMethod = 'DELETE' | 'GET' | 'HEAD' | 'OPTIONS' | 'PATCH' | 'POST' | 'PUT';

export type AvirxExpectedStatusInput = number | readonly number[];

export type AvirxHeaders = Readonly<Record<string, string>>;
