import path from 'node:path';
import {
    genericNameDebt,
    javascriptDebt,
    rootSourceDebt,
} from '../config/layout-debt.mts';
import { lineDebt } from '../config/line-debt.mts';
import { rootSourceFacades } from './source-facades.mts';

export const moduleLineLimit = 150;

const genericNames = new Set([
    'common',
    'config',
    'helper',
    'helpers',
    'utilities',
    'utility',
    'utils',
]);

export function inspectModuleLayout(relative: string, lineCount: number): string[] {
    return [
        ...inspectLineCount(relative, lineCount),
        ...inspectLanguage(relative),
        ...inspectModuleName(relative),
        ...inspectSourcePlacement(relative),
    ];
}

function inspectLineCount(relative: string, lineCount: number): string[] {
    const acceptedDebt = lineDebt.get(relative);
    if (lineCount <= moduleLineLimit) {
        return acceptedDebt === undefined
            ? []
            : [`${relative}: remove its stale line-debt entry.`];
    }
    if (acceptedDebt === undefined) {
        return [`${relative}: ${String(lineCount)} lines exceeds the 150-line limit.`];
    }
    if (lineCount > acceptedDebt) {
        return [`${relative}: line debt grew from ${String(acceptedDebt)} to ${String(lineCount)}.`];
    }
    return [];
}

function inspectLanguage(relative: string): string[] {
    if (!relative.endsWith('.js') && !relative.endsWith('.mjs')) {
        return [];
    }
    return javascriptDebt.has(relative)
        ? []
        : [`${relative}: owned modules must use TypeScript.`];
}

function inspectModuleName(relative: string): string[] {
    const basename = path.posix.basename(relative)
        .replace(/\.(?:test\.)?(?:m?[jt]s)$/u, '');
    if (!genericNames.has(basename) || genericNameDebt.has(relative)) {
        return [];
    }
    return [`${relative}: generic junk-drawer module names are forbidden.`];
}

function inspectSourcePlacement(relative: string): string[] {
    if (!relative.startsWith('src/')) {
        return [];
    }
    if (path.posix.basename(relative) === 'index.ts' && relative !== 'src/index.ts') {
        return [`${relative}: nested source index modules are forbidden.`];
    }
    if (
        path.posix.dirname(relative) !== 'src'
        || rootSourceFacades.has(relative)
    ) {
        return [];
    }
    return rootSourceDebt.has(relative)
        ? []
        : [`${relative}: root source modules require deliberate facade ownership.`];
}
