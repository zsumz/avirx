import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectDebtPaths } from './config/inspect-debt.mts';
import { inspectPublicEntrypoint } from './contract/public-entrypoint.mts';
import { inspectPublicSymbols } from './contract/public-symbols.mts';
import {
    createRuntimeDependencyGraph,
    findDependencyCycles,
} from './dependency/runtime-dependencies.mts';
import { collectModuleFiles, relativePath } from './files/module-files.mts';
import { inspectModuleLayout } from './module/module-layout.mts';
import { inspectSourceDomains } from './module/source-domains.mts';
import { inspectSourceFacade } from './module/source-facades.mts';

const root = fileURLToPath(new URL('../../', import.meta.url));
const ownedRoots = ['examples', 'scripts', 'src', 'tests'];
const failures = await inspectArchitecture();

if (failures.length > 0) {
    console.error('Architecture guardrails failed:\n');
    for (const failure of failures) {
        console.error(`- ${failure}`);
    }
    process.exitCode = 1;
} else {
    console.log('Architecture guardrails passed.');
}

async function inspectArchitecture(): Promise<string[]> {
    const inspections: string[] = [];
    const files = (await Promise.all(
        ownedRoots.map(async (ownedRoot) => collectModuleFiles(path.join(root, ownedRoot))),
    )).flat();
    const relativeFiles = new Set(files.map((file) => relativePath(root, file)));

    for (const file of files) {
        const relative = relativePath(root, file);
        const source = await readFile(file, 'utf8');
        inspections.push(...inspectModuleLayout(relative, countLines(source)));
        inspections.push(...inspectSourceFacade(relative, source));
        inspections.push(...inspectLineWidths(relative, source));
    }
    inspections.push(...inspectDebtPaths(relativeFiles));
    inspections.push(...await inspectPublicEntrypoint(root));
    inspections.push(...await inspectPublicSymbols(root));
    inspections.push(...await inspectSourceDependencies(files));
    return inspections;
}

async function inspectSourceDependencies(ownedFiles: readonly string[]): Promise<string[]> {
    const sourceFiles = ownedFiles.filter((file) => file.includes(`${path.sep}src${path.sep}`));
    const graph = await createRuntimeDependencyGraph(sourceFiles);
    const failures = inspectSourceDomains(root, graph);
    failures.push(...findDependencyCycles(graph).map((cycle) => {
        const relativeCycle = cycle.map((file) => relativePath(root, file));
        return `src: circular runtime dependency ${relativeCycle.join(' -> ')}`;
    }));
    return failures;
}

function inspectLineWidths(relative: string, source: string): string[] {
    return source.split(/\r?\n/u).flatMap((line, index) => line.length <= 120
        ? []
        : [`${relative}:${String(index + 1)} has ${String(line.length)} characters.`]);
}

function countLines(source: string): number {
    if (source.length === 0) {
        return 0;
    }
    const lineCount = source.split(/\r?\n/u).length;
    return source.endsWith('\n') ? lineCount - 1 : lineCount;
}
