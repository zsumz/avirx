import { readFile } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';

const expectedSymbols = new Set([
    'AvirxAnyEndpointDefinition',
    'AvirxAuthBuilder',
    'AvirxAuthPolicy',
    'AvirxAuthState',
    'AvirxAuthTokenProvider',
    'AvirxBodyValue',
    'AvirxBuiltRequest',
    'AvirxCacheInput',
    'AvirxCacheMethod',
    'AvirxCachePolicy',
    'AvirxClient',
    'AvirxClientOptions',
    'AvirxClientState',
    'AvirxConcurrencyInput',
    'AvirxConcurrencyLimiter',
    'AvirxContractCall',
    'AvirxContractClient',
    'AvirxContractInput',
    'AvirxContractOutput',
    'AvirxCurlOptions',
    'AvirxDownload',
    'AvirxDurationInput',
    'AvirxEndpointBuilder',
    'AvirxEndpointContract',
    'AvirxEndpointDefinition',
    'AvirxEndpointState',
    'AvirxError',
    'AvirxExpectedStatusInput',
    'AvirxHeaders',
    'AvirxHookContext',
    'AvirxHookEvent',
    'AvirxHookHandler',
    'AvirxHookRegistry',
    'AvirxInferSchema',
    'AvirxMultipartBuilder',
    'AvirxMultipartFieldValue',
    'AvirxMultipartFileValue',
    'AvirxPathParamNames',
    'AvirxPathParams',
    'AvirxPreview',
    'AvirxQueryInput',
    'AvirxQueryValue',
    'AvirxRateLimitInput',
    'AvirxRateLimitLimiter',
    'AvirxRequestBuilder',
    'AvirxRequestState',
    'AvirxRequestTimeoutInput',
    'AvirxResponse',
    'AvirxResult',
    'AvirxRetryEvent',
    'AvirxRetryInput',
    'AvirxRetryMetadata',
    'AvirxSchema',
    'AvirxTimingMetadata',
    'HttpMethod',
    'avirx',
    'endpoint',
    'formatCurl',
    'isAvirxError',
    'parseWithSchema',
]);

export async function inspectPublicSymbols(root: string): Promise<string[]> {
    const pathToIndex = path.join(root, 'src/index.ts');
    const source = await readFile(pathToIndex, 'utf8');
    const file = ts.createSourceFile(pathToIndex, source, ts.ScriptTarget.Latest, true);
    const actualSymbols = collectNamedExports(file);
    const missing = [...expectedSymbols].filter((name) => !actualSymbols.has(name));
    const unexpected = [...actualSymbols].filter((name) => !expectedSymbols.has(name));
    return [
        ...missing.map((name) => `src/index.ts: missing public symbol ${name}.`),
        ...unexpected.map((name) => `src/index.ts: unexpected public symbol ${name}.`),
    ];
}

function collectNamedExports(file: ts.SourceFile): ReadonlySet<string> {
    const symbols: Set<string> = new Set();
    for (const statement of file.statements) {
        if (ts.isExportDeclaration(statement) && statement.exportClause
            && ts.isNamedExports(statement.exportClause)) {
            for (const element of statement.exportClause.elements) {
                symbols.add(element.name.text);
            }
        }
    }
    return symbols;
}
