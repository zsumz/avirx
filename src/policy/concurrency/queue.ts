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
    const entries: Array<ConcurrencyQueueEntry | undefined> = [];
    let head = 0;
    let size = 0;

    function compact(): void {
        if (head > 32 && head * 2 >= entries.length) {
            entries.splice(0, head);
            head = 0;
        }
    }

    return {
        dequeue() {
            while (head < entries.length) {
                const entry = entries[head];
                entries[head] = undefined;
                head += 1;
                if (entry) {
                    size -= 1;
                    compact();
                    return entry;
                }
            }
            compact();
            return undefined;
        },
        enqueue(entry) {
            entries.push(entry);
            size += 1;
        },
        remove(entry) {
            const index = entries.indexOf(entry, head);
            if (index !== -1) {
                entries[index] = undefined;
                size -= 1;
                compact();
            }
        },
        size() {
            return size;
        },
    };
}
