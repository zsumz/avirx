export type HttpMethod = 'DELETE' | 'GET' | 'HEAD' | 'OPTIONS' | 'PATCH' | 'POST' | 'PUT';

export type AvirxDurationInput = `${number}ms` | `${number}s` | number;

export type AvirxExpectedStatusInput = number | readonly number[];

export type AvirxCurlOptions = Readonly<{
    redacted?: boolean;
}>;

export type AvirxPrimitiveValue = boolean | number | string;

export type AvirxHeaders = Readonly<Record<string, string>>;
