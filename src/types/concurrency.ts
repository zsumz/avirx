export type AvirxConcurrencyInput = number;

export type AvirxConcurrencyLimiter = Readonly<{
    acquire(signal?: AbortSignal): Promise<() => void>;
    active(): number;
    max: number;
    queued(): number;
}>;
