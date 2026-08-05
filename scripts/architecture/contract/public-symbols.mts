import { readFile } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
import { expectedPublicTypes, expectedPublicValues } from './public-contract.mts';

export async function inspectPublicSymbols(root: string): Promise<string[]> {
    const pathToIndex = path.join(root, 'src/index.ts');
    const source = await readFile(pathToIndex, 'utf8');
    return inspectPublicSymbolSource(source);
}

export function inspectPublicSymbolSource(source: string): string[] {
    const file = ts.createSourceFile('src/index.ts', source, ts.ScriptTarget.Latest, true);
    const contract = collectPublicExports(file);
    return [
        ...contract.failures,
        ...compareSpace('value', expectedPublicValues, contract.values),
        ...compareSpace('type', expectedPublicTypes, contract.types),
    ];
}

type PublicExports = Readonly<{
    failures: readonly string[];
    types: ReadonlySet<string>;
    values: ReadonlySet<string>;
}>;

function collectPublicExports(file: ts.SourceFile): PublicExports {
    const failures: string[] = [];
    const types: Set<string> = new Set();
    const values: Set<string> = new Set();
    for (const statement of file.statements) {
        if (isDefaultExport(statement)) {
            failures.push('src/index.ts: default exports are not allowed.');
        }
        if (!ts.isExportDeclaration(statement)) {
            continue;
        }
        const clause = statement.exportClause;
        if (clause === undefined || ts.isNamespaceExport(clause)) {
            failures.push('src/index.ts: export-star declarations are not allowed.');
            continue;
        }
        for (const element of clause.elements) {
            const name = element.name.text;
            if (name === 'default') {
                failures.push('src/index.ts: default exports are not allowed.');
                continue;
            }
            const space = statement.isTypeOnly || element.isTypeOnly ? types : values;
            space.add(name);
        }
    }
    return { failures, types, values };
}

function compareSpace(
    space: 'type' | 'value',
    expected: ReadonlySet<string>,
    actual: ReadonlySet<string>,
): string[] {
    const missing = [...expected].filter((name) => !actual.has(name));
    const unexpected = [...actual].filter((name) => !expected.has(name));
    return [
        ...missing.map((name) => `src/index.ts: missing public ${space} ${name}.`),
        ...unexpected.map((name) => `src/index.ts: unexpected public ${space} ${name}.`),
    ];
}

function isDefaultExport(statement: ts.Statement): boolean {
    if (ts.isExportAssignment(statement)) {
        return true;
    }
    const modifiers = ts.canHaveModifiers(statement) ? ts.getModifiers(statement) : undefined;
    return modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword) ?? false;
}
