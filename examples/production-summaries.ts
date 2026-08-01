import type { AvirxResult } from 'avirx';
import type {
    ApiError,
    Book,
    ProductionExampleSummary,
} from './production-types.js';

export function summarizeUnauthorized(
    result: AvirxResult<Book, ApiError>,
): ProductionExampleSummary['unauthorized'] {
    if (result.ok || result.status !== 401 || result.error.data === undefined) {
        throw new Error('Expected an unauthorized result.');
    }
    return {
        code: result.error.data.code,
        ok: false,
        status: result.status,
    };
}

export function summarizeCancellation(
    result: AvirxResult<Book>,
): ProductionExampleSummary['cancellation'] {
    if (result.ok) {
        throw new Error('Expected a cancellation result.');
    }
    return {
        message: result.error.message,
        ok: false,
    };
}
