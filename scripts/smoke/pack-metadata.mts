import { assertCondition } from './assertion.mts';

export type PackedFile = Readonly<{
    path: string;
    size: number;
}>;

export type PackedMetadata = Readonly<{
    filename: string;
    files: readonly PackedFile[];
}>;

export function parsePackedMetadata(output: string): PackedMetadata {
    const parsed: unknown = JSON.parse(output);
    const candidates = collectCandidates(parsed);
    assertCondition(candidates.length === 1, 'npm pack did not report exactly one package.');
    const [packed] = candidates;
    assertCondition(packed !== undefined, 'npm pack did not report package metadata.');
    assertCondition(typeof packed.filename === 'string', 'npm pack did not report a tarball filename.');
    assertCondition(Array.isArray(packed.files), 'npm pack did not report packed files.');
    assertCondition(
        packed.files.every(isPackedFile),
        'npm pack reported a file without a path.',
    );
    return {
        filename: packed.filename,
        files: packed.files,
    };
}

function collectCandidates(value: unknown): PackCandidate[] {
    if (Array.isArray(value)) {
        return value.filter(isPackCandidate);
    }
    if (!isRecord(value)) {
        return [];
    }
    if (isPackCandidate(value)) {
        return [value];
    }
    return Object.values(value).filter(isPackCandidate);
}

type PackCandidate = Readonly<{
    filename?: unknown;
    files?: unknown;
}>;

function isPackCandidate(value: unknown): value is PackCandidate {
    return isRecord(value) && ('filename' in value || 'files' in value);
}

function isPackedFile(value: unknown): value is PackedFile {
    return isRecord(value)
        && typeof value.path === 'string'
        && typeof value.size === 'number'
        && Number.isSafeInteger(value.size)
        && value.size >= 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
