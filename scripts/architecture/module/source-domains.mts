import { relativePath } from '../files/module-files.mts';

const allowedDependencies: Readonly<Record<string, ReadonlySet<string>>> = {
    client: new Set(['contract', 'policy', 'request', 'state', 'time', 'transport', 'types']),
    contract: new Set(['request', 'transport', 'types']),
    error: new Set(['types']),
    execution: new Set(['contract', 'error', 'policy', 'request', 'response', 'transport', 'types']),
    policy: new Set(['error', 'response', 'time', 'transport', 'types']),
    request: new Set(['policy', 'response', 'state', 'time', 'transport', 'types']),
    response: new Set(['contract', 'error', 'execution', 'policy', 'transport', 'types']),
    state: new Set(),
    time: new Set(['types']),
    transport: new Set(['error', 'types']),
    types: new Set(['error']),
};

export function inspectSourceDomains(
    root: string,
    graph: ReadonlyMap<string, ReadonlySet<string>>,
): string[] {
    const failures: string[] = [];
    for (const [source, dependencies] of graph) {
        const sourceDomain = sourceDomainOf(root, source);
        if (sourceDomain === undefined) {
            continue;
        }
        const allowed = allowedDependencies[sourceDomain];
        if (allowed === undefined) {
            failures.push(`${relativePath(root, source)}: source domain is not declared.`);
            continue;
        }
        for (const dependency of dependencies) {
            const targetDomain = sourceDomainOf(root, dependency);
            if (
                targetDomain !== undefined
                && targetDomain !== sourceDomain
                && !allowed.has(targetDomain)
            ) {
                failures.push(
                    `${relativePath(root, source)}: ${sourceDomain} must not import ${targetDomain}.`,
                );
            }
        }
    }
    return failures;
}

function sourceDomainOf(root: string, file: string): string | undefined {
    const relative = relativePath(root, file);
    const segments = relative.split('/');
    if (segments[0] !== 'src' || segments.length < 3) {
        return undefined;
    }
    return segments[1];
}
