import ts from 'typescript';

export const rootSourceFacades = new Set([
    'src/index.ts',
    'src/types.ts',
]);

export function inspectSourceFacade(relative: string, source: string): string[] {
    if (!rootSourceFacades.has(relative)) {
        return [];
    }
    const sourceFile = ts.createSourceFile(
        relative,
        source,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS,
    );
    const impure = sourceFile.statements.some((statement) =>
        !ts.isExportDeclaration(statement) || statement.moduleSpecifier === undefined);
    return impure ? [`${relative}: root source facades must contain only re-exports.`] : [];
}
