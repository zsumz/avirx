import { createEndpoint } from './create-endpoint.js';
import type { AvirxEndpointBuilder } from '../types.js';

export const endpoint: AvirxEndpointBuilder = Object.freeze({
    delete(path) {
        return createEndpoint('DELETE', path);
    },
    get(path) {
        return createEndpoint('GET', path);
    },
    head(path) {
        return createEndpoint('HEAD', path);
    },
    options(path) {
        return createEndpoint('OPTIONS', path);
    },
    patch(path) {
        return createEndpoint('PATCH', path);
    },
    post(path) {
        return createEndpoint('POST', path);
    },
    put(path) {
        return createEndpoint('PUT', path);
    },
});
