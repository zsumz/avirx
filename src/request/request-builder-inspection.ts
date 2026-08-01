import { buildRequest } from './build-request.js';
import { formatCurl } from './curl.js';
import { resolveEffectiveAuth } from './effective-auth.js';
import type { RequestBuilderContext } from './request-builder-context.js';
import type {
    AvirxBodyValue,
    AvirxBuiltRequest,
    AvirxCurlOptions,
    AvirxHeaders,
    HttpMethod,
} from '../types.js';

export function createRequestInspection<
    Route extends string,
    CanHaveBody extends boolean,
    ErrorData,
>(
    context: RequestBuilderContext<Route, CanHaveBody, ErrorData>,
): Readonly<Record<string, unknown>> {
    const build = async (): Promise<AvirxBuiltRequest> => buildRequest(
        context.clientState,
        context.state,
        await resolveEffectiveAuth(context.clientState, context.state),
    );
    return {
        build,
        async curl(options?: AvirxCurlOptions) {
            return formatCurl(await build(), options);
        },
        async preview() {
            const built = await build();
            const preview: MutablePreview = {
                curl: formatCurl(built),
                headers: built.redactedHeaders,
                method: built.method,
                redactions: {
                    headers: built.redactedHeaders,
                    url: built.redactedUrl.href,
                },
                url: built.redactedUrl.href,
            };
            if ('body' in built) {
                preview.body = built.body;
            }
            return Object.freeze(preview);
        },
    };
}

interface MutablePreview {
    body?: AvirxBodyValue;
    curl: string;
    headers: AvirxHeaders;
    method: HttpMethod;
    redactions: { headers: AvirxHeaders; url: string };
    url: string;
}
