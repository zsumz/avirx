import {
    httpJson,
    type HttpTestRequest,
    type HttpTestResponse,
    type HttpTestRouteHandler,
    type HttpTestServer,
} from './http-server.js';

export type HttpSimulationStep = HttpTestResponse | HttpTestRouteHandler;

export type HttpSimulationRoute = Readonly<{
    attempts: readonly HttpTestRequest[];
    waitForAttempts(count?: number): Promise<readonly HttpTestRequest[]>;
}>;

interface AttemptWaiter {
    count: number;
    reject(error: Error): void;
    resolve(attempts: readonly HttpTestRequest[]): void;
    timeout: ReturnType<typeof setTimeout>;
}

export function delayed(response: HttpTestResponse, delayMs: number): HttpTestResponse {
    return {
        ...response,
        delayMs,
    };
}

export function malformedJson(body = '{', init: Omit<HttpTestResponse, 'body'> = {}): HttpTestResponse {
    return {
        ...init,
        body,
        headers: {
            'content-type': 'application/json',
            ...headersToRecord(init.headers),
        },
    };
}

export function closeConnection(delayMs = 0): HttpTestResponse {
    return {
        delayMs,
        fail: 'close',
    };
}

export function sequence(
    server: HttpTestServer,
    method: string,
    path: string,
    steps: readonly HttpSimulationStep[],
): HttpSimulationRoute {
    if (steps.length === 0) {
        throw new TypeError('HTTP simulation sequence requires at least one step.');
    }

    const attempts: HttpTestRequest[] = [];
    const waiters: AttemptWaiter[] = [];
    let index = 0;

    server.route(method, path, async (request) => {
        attempts.push(request);
        notifyWaiters();
        const step = steps[Math.min(index, steps.length - 1)];
        index += 1;

        if (typeof step === 'function') {
            return step(request);
        }

        return step ?? httpJson({ code: 'missing_step' }, { status: 500 });
    });

    async function waitForAttempts(count = 1): Promise<readonly HttpTestRequest[]> {
        if (attempts.length >= count) {
            return Promise.resolve(attempts);
        }

        return new Promise((resolve, reject) => {
            const waiter: AttemptWaiter = {
                count,
                reject,
                resolve,
                timeout: setTimeout(() => {
                    removeWaiter(waiter);
                    reject(new Error(`Timed out waiting for ${String(count)} HTTP simulation attempt(s).`));
                }, 1000),
            };

            waiters.push(waiter);
        });
    }

    function notifyWaiters(): void {
        for (const waiter of [...waiters]) {
            if (attempts.length >= waiter.count) {
                removeWaiter(waiter);
                waiter.resolve(attempts);
            }
        }
    }

    function removeWaiter(waiter: AttemptWaiter): void {
        const waiterIndex = waiters.indexOf(waiter);
        if (waiterIndex !== -1) {
            waiters.splice(waiterIndex, 1);
            clearTimeout(waiter.timeout);
        }
    }

    return Object.freeze({ attempts, waitForAttempts });
}

function headersToRecord(headers: HeadersInit | undefined): Record<string, string> {
    const normalized = new Headers(headers);
    const record: Record<string, string> = {};

    normalized.forEach((value, key) => {
        record[key] = value;
    });

    return record;
}
