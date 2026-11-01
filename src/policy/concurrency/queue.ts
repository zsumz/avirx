export interface ConcurrencyQueueEntry {
    abort?: () => void;
    grant: () => void;
    signal?: AbortSignal;
}

export interface ConcurrencyQueue {
    dequeue(): ConcurrencyQueueEntry | undefined;
    enqueue(entry: ConcurrencyQueueEntry): void;
    remove(entry: ConcurrencyQueueEntry): void;
    size(): number;
}

export function createConcurrencyQueue(): ConcurrencyQueue {
    const entries: Set<ConcurrencyQueueEntry> = new Set();

    return {
        dequeue() {
            const entry = entries.values().next().value;
            if (entry) entries.delete(entry);
            return entry;
        },
        enqueue(entry) {
            entries.add(entry);
        },
        remove(entry) {
            entries.delete(entry);
        },
        size() {
            return entries.size;
        },
    };
}
