import path from 'node:path';
import ts from 'typescript';

export function collectModuleSpecifiers(file: string, source: string): string[] {
    const sourceFile = ts.createSourceFile(
        file,
        source,
        ts.ScriptTarget.Latest,
        true,
        file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    const specifiers: string[] = [];

    for (const statement of sourceFile.statements) {
        if (
            isRuntimeModuleReference(statement)
            && statement.moduleSpecifier !== undefined
            && ts.isStringLiteral(statement.moduleSpecifier)
        ) {
            specifiers.push(statement.moduleSpecifier.text);
        }
    }
    visitDynamicImports(sourceFile, specifiers);
    return specifiers;
}

function isRuntimeModuleReference(
    statement: ts.Statement,
): statement is ts.ImportDeclaration | ts.ExportDeclaration {
    if (ts.isImportDeclaration(statement)) {
        return hasRuntimeImport(statement.importClause);
    }
    if (!ts.isExportDeclaration(statement) || statement.isTypeOnly) {
        return false;
    }
    const clause = statement.exportClause;
    return clause === undefined
        || !ts.isNamedExports(clause)
        || clause.elements.length === 0
        || clause.elements.some((element) => !element.isTypeOnly);
}

function hasRuntimeImport(clause: ts.ImportClause | undefined): boolean {
    if (clause === undefined) {
        return true;
    }
    if (clause.phaseModifier === ts.SyntaxKind.TypeKeyword) {
        return false;
    }
    if (clause.name !== undefined) {
        return true;
    }
    const bindings = clause.namedBindings;
    if (bindings === undefined) {
        return false;
    }
    return ts.isNamespaceImport(bindings)
        || bindings.elements.length === 0
        || bindings.elements.some((element) => !element.isTypeOnly);
}

export function resolveSourceReference(
    sourceFile: string,
    specifier: string,
    sourceFiles: ReadonlySet<string>,
): string | undefined {
    if (!specifier.startsWith('.')) {
        return undefined;
    }
    const resolved = path.resolve(path.dirname(sourceFile), specifier);
    const candidates = sourceCandidates(resolved);
    return candidates.find((candidate) => sourceFiles.has(candidate));
}

function sourceCandidates(resolved: string): string[] {
    const extension = path.extname(resolved);
    const withoutExtension = extension.length > 0 ? resolved.slice(0, -extension.length) : resolved;
    return [
        resolved,
        `${withoutExtension}.ts`,
        `${withoutExtension}.mts`,
        path.join(resolved, 'index.ts'),
        path.join(resolved, 'index.mts'),
    ];
}

function visitDynamicImports(node: ts.Node, specifiers: string[]): void {
    const argument = ts.isCallExpression(node) ? node.arguments[0] : undefined;
    if (
        ts.isCallExpression(node)
        && node.expression.kind === ts.SyntaxKind.ImportKeyword
        && node.arguments.length === 1
        && argument !== undefined
        && ts.isStringLiteral(argument)
    ) {
        specifiers.push(argument.text);
    }
    ts.forEachChild(node, (child) => {
        visitDynamicImports(child, specifiers);
    });
}
