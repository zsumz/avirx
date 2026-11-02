interface ResponseControl {
    controller: AbortController;
    signal?: AbortSignal;
}
const responseControllers: WeakMap<Response, ResponseControl> = new WeakMap();

export function registerResponseDisposal(
    response: Response,
    controller: AbortController,
    signal?: AbortSignal,
): void {
    responseControllers.set(response, { controller, ...signal ? { signal } : {} });
}

export function getResponseAbortSignal(response: Response): AbortSignal | undefined {
    return responseControllers.get(response)?.signal;
}

export function discardResponse(response: Response): void {
    responseControllers.get(response)?.controller.abort();
    responseControllers.delete(response);

    if (response.body && !response.body.locked) {
        // Initiate cancellation without waiting for user-owned cloned branches to finish.
        void response.body.cancel().catch(() => undefined);
    }
}
