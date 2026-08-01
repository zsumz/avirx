export type AvirxRetryInput = number | Readonly<{
    attempts: number;
    on?: readonly number[];
}>;

export type AvirxRetryEvent = Readonly<{
    attempt: number;
    delayMs: number;
    status: number;
}>;

export type AvirxRetryMetadata = Readonly<{
    attempts: number;
    on: readonly number[];
    safeOnly: boolean;
}>;
