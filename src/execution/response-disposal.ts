const responseControllers: WeakMap<Response, AbortController> = new WeakMap();

export function registerResponseDisposal(response: Response, controller: AbortController): void {
    responseControllers.set(response, controller);
}

export function discardResponse(response: Response): void {
    responseControllers.get(response)?.abort();
    responseControllers.delete(response);

    if (response.body && !response.body.locked) {
        // Initiate cancellation without waiting for user-owned cloned branches to finish.
        void response.body.cancel().catch(() => undefined);
    }
}
