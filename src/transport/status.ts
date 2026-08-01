export function normalizeExpectedStatuses(input: number | readonly number[]): ReadonlySet<number> {
    const statuses = Array.isArray(input) ? input : [input];

    if (statuses.length === 0) {
        throw new TypeError('Expected status list cannot be empty.');
    }

    return Object.freeze(new Set(statuses.map(validateStatus)));
}

export function isExpectedStatus(status: number, expectedStatuses: ReadonlySet<number>): boolean {
    if (expectedStatuses.size === 0) {
        return status >= 200 && status <= 299;
    }

    return expectedStatuses.has(status);
}

function validateStatus(status: number): number {
    if (!Number.isInteger(status) || status < 100 || status > 599) {
        throw new TypeError(`Invalid HTTP status ${String(status)}. Expected an integer from 100 to 599.`);
    }

    return status;
}
