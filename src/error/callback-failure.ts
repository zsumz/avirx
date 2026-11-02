export class CallbackFailure extends Error {
    public readonly value: unknown;

    constructor(value: unknown) {
        super('Callback failed.');
        this.value = value;
    }
}

export async function callCallback<T>(callback: () => T | Promise<T>): Promise<T> {
    try {
        return await callback();
    } catch (error) {
        throw error instanceof CallbackFailure ? error : new CallbackFailure(error);
    }
}

export async function exposeCallbackFailure<T>(operation: () => Promise<T>): Promise<T> {
    try {
        return await operation();
    } catch (error) {
        // Preserve arbitrary callback values, including primitives.
        // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
        return Promise.reject(error instanceof CallbackFailure ? error.value : error);
    }
}
