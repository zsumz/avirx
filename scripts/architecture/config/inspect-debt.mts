import {
    genericNameDebt,
    javascriptDebt,
    rootSourceDebt,
} from './layout-debt.mts';
import { lineDebt } from './line-debt.mts';

export function inspectDebtPaths(ownedPaths: ReadonlySet<string>): string[] {
    const failures: string[] = [];
    const debtGroups: ReadonlyArray<readonly [string, Iterable<string>]> = [
        ['generic-name', genericNameDebt],
        ['JavaScript', javascriptDebt],
        ['line', lineDebt.keys()],
        ['root-source', rootSourceDebt],
    ];

    for (const [label, paths] of debtGroups) {
        for (const path of paths) {
            if (!ownedPaths.has(path)) {
                failures.push(`${path}: remove its stale ${label} debt entry.`);
            }
        }
    }
    return failures;
}
