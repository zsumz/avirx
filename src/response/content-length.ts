export function parseContentLength(value: string | undefined): number | undefined {
    if (value === undefined || !/^\d+$/u.test(value)) {
        return undefined;
    }

    const parsed = Number(value);
    return Number.isSafeInteger(parsed) ? parsed : undefined;
}
