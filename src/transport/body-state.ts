import { classifyBody } from './body.js';
import type {
    AvirxBodyMetadata,
    AvirxBodyValue,
    AvirxHeaders,
    AvirxRequestState,
} from '../types.js';

export function prepareBodyState(
    clientHeaders: AvirxHeaders,
    state: AvirxRequestState,
    body: AvirxBodyValue,
): {
    body: AvirxBodyValue;
    bodyMetadata: AvirxBodyMetadata;
    headers: AvirxHeaders;
} {
    const bodyValue = cloneBodyValue(body);

    if (body === undefined) {
        return {
            body: bodyValue,
            bodyMetadata: classifyBody(bodyValue),
            headers: state.headers,
        };
    }

    const metadata = classifyBody(bodyValue);
    if (metadata.kind !== 'json') {
        return {
            body: bodyValue,
            bodyMetadata: metadata,
            headers: state.headers,
        };
    }

    const serializedBody = JSON.stringify(bodyValue);
    return {
        body: serializedBody,
        bodyMetadata: {
            contentLength: new TextEncoder().encode(serializedBody).byteLength,
            contentType: 'application/json',
            kind: 'json',
        },
        headers: hasContentType(clientHeaders) || hasContentType(state.headers)
            ? state.headers
            : {
                ...state.headers,
                'content-type': 'application/json',
            },
    };
}

export function cloneBodyValue(body: AvirxBodyValue): AvirxBodyValue {
    if (body instanceof URLSearchParams) {
        return new URLSearchParams(body);
    }

    if (body instanceof ArrayBuffer) {
        return body.slice(0);
    }

    if (body instanceof FormData) {
        return cloneFormData(body);
    }

    return body;
}

export function defineBodySnapshot(target: object, body: AvirxBodyValue): void {
    const snapshot = cloneBodyValue(body);
    Object.defineProperty(target, 'body', {
        enumerable: true,
        get() {
            return cloneBodyValue(snapshot);
        },
    });
}

export function cloneFormData(body: AvirxBodyValue): FormData {
    if (!(body instanceof FormData)) {
        throw new TypeError('Expected multipart body state to contain FormData.');
    }

    const data = new FormData();
    body.forEach((value, key) => {
        data.append(key, value);
    });
    return data;
}

function hasContentType(headers: AvirxHeaders): boolean {
    return headers['content-type'] !== undefined;
}
