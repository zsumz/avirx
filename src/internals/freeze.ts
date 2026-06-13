export function freezeRecord<T extends Readonly<Record<string, unknown>>>(value: T): T {
    return Object.freeze({ ...value });
}

class ReadonlySnapshotSet<T> implements ReadonlySet<T> {
    readonly #values: ReadonlySet<T>;

    public readonly [Symbol.toStringTag] = 'Set';

    constructor(values: Iterable<T> = []) {
        this.#values = new Set(values);
        Object.freeze(this);
    }

    public get size(): number {
        return this.#values.size;
    }

    public entries(): SetIterator<[T, T]> {
        return this.#values.entries();
    }

    public difference<U>(other: ReadonlySetLike<U>): Set<T> {
        const next: Set<T> = new Set();
        for (const value of this.#values) {
            if (!other.has(value as unknown as U)) {
                next.add(value);
            }
        }
        return next;
    }

    public forEach(
        callbackfn: (value: T, value2: T, set: ReadonlySet<T>) => void,
        thisArg?: unknown,
    ): void {
        for (const value of this.#values) {
            callbackfn.call(thisArg, value, value, this);
        }
    }

    public has(value: T): boolean {
        return this.#values.has(value);
    }

    public intersection<U>(other: ReadonlySetLike<U>): Set<T & U> {
        const next: Set<T & U> = new Set();
        for (const value of this.#values) {
            if (other.has(value as unknown as U)) {
                next.add(value as T & U);
            }
        }
        return next;
    }

    public isDisjointFrom(other: ReadonlySetLike<unknown>): boolean {
        let isDisjoint = true;
        forEachSetLikeValue(other, (value) => {
            if (this.#values.has(value as T)) {
                isDisjoint = false;
                return false;
            }
            return true;
        });
        return isDisjoint;
    }

    public isSubsetOf(other: ReadonlySetLike<unknown>): boolean {
        for (const value of this.#values) {
            if (!other.has(value)) {
                return false;
            }
        }
        return true;
    }

    public isSupersetOf(other: ReadonlySetLike<unknown>): boolean {
        let isSuperset = true;
        forEachSetLikeValue(other, (value) => {
            if (!this.#values.has(value as T)) {
                isSuperset = false;
                return false;
            }

            return true;
        });
        return isSuperset;
    }

    public keys(): SetIterator<T> {
        return this.#values.keys();
    }

    public symmetricDifference<U>(other: ReadonlySetLike<U>): Set<T | U> {
        const next = this.difference(other) as Set<T | U>;
        forEachSetLikeValue(other, (value) => {
            if (!this.#values.has(value as unknown as T)) {
                next.add(value);
            }
            return true;
        });
        return next;
    }

    public union<U>(other: ReadonlySetLike<U>): Set<T | U> {
        const next: Set<T | U> = new Set(this.#values);
        forEachSetLikeValue(other, (value) => {
            next.add(value);
            return true;
        });
        return next;
    }

    public values(): SetIterator<T> {
        return this.#values.values();
    }

    public [Symbol.iterator](): SetIterator<T> {
        return this.values();
    }
}

export function createReadonlySet<T>(values?: Iterable<T>): ReadonlySet<T> {
    return new ReadonlySnapshotSet(values);
}

function forEachSetLikeValue<T>(
    setLike: ReadonlySetLike<T>,
    callback: (value: T) => boolean,
): void {
    const iterator = setLike.keys();
    for (;;) {
        const result = iterator.next();
        if (result.done) {
            return;
        }

        if (!callback(result.value)) {
            return;
        }
    }
}
