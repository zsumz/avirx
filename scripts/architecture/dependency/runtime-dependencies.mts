import { readFile } from 'node:fs/promises';
import {
    collectModuleSpecifiers,
    resolveSourceReference,
} from '../module/source-references.mts';

export async function createRuntimeDependencyGraph(
    files: readonly string[],
): Promise<ReadonlyMap<string, ReadonlySet<string>>> {
    const knownFiles = new Set(files);
    const graph: Map<string, ReadonlySet<string>> = new Map();

    for (const file of files) {
        const source = await readFile(file, 'utf8');
        const dependencies = collectModuleSpecifiers(file, source)
            .map((specifier) => resolveSourceReference(file, specifier, knownFiles))
            .filter((target): target is string => target !== undefined);
        graph.set(file, new Set(dependencies));
    }
    return graph;
}

export function findDependencyCycles(
    graph: ReadonlyMap<string, ReadonlySet<string>>,
): string[][] {
    const cycles: string[][] = [];
    const completed: Set<string> = new Set();
    const active: string[] = [];

    for (const module of graph.keys()) {
        visit(module, graph, active, completed, cycles);
    }
    return cycles;
}

function visit(
    module: string,
    graph: ReadonlyMap<string, ReadonlySet<string>>,
    active: string[],
    completed: Set<string>,
    cycles: string[][],
): void {
    if (completed.has(module)) {
        return;
    }
    const activeIndex = active.indexOf(module);
    if (activeIndex >= 0) {
        cycles.push([...active.slice(activeIndex), module]);
        return;
    }
    active.push(module);
    for (const dependency of graph.get(module) ?? []) {
        visit(dependency, graph, active, completed, cycles);
    }
    active.pop();
    completed.add(module);
}
