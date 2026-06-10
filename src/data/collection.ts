import {Queue} from "./queue";
import * as fs from "node:fs";
import type {PathLike} from "fs";
import type {FileHandle} from "fs/promises";
import type {NonObject} from "../types";
import * as console from "node:console";

export abstract class ObjectQueueMap<K, V> {
    private inner: Queue<Map<K, V>> = new Queue(new Map());

    constructor(
        private path: PathLike | FileHandle,
    ) {}

    protected abstract key(value: V): K;

    async withLock<R>(fn: (entries: {map: Map<K, V>, save: () => Promise<void>}) => R | Promise<R>): Promise<R> {
        return this.inner.withLock(async map => {
            const save = () => this.save(map);
            return fn({ map, save })
        });
    }

    async load() {
        await this.inner.withLock(async map => {
            try {
                const data = await fs.promises.readFile(this.path, 'utf8');
                const parsed = JSON.parse(data) as V[];

                map.clear();

                for (const value of parsed) {
                    map.set(this.key(value), value)
                }
            } catch (e: NodeJS.ErrnoException | unknown) {
                if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;

                await fs.promises.writeFile(this.path, JSON.stringify([]), 'utf8');
                map.clear();
            }
        });

        return this;
    }

    private async save(map: Map<K, V>) {
        await fs.promises.writeFile(
            this.path,
            JSON.stringify(Array.from(map.values()), null, 2),
            "utf-8"
        )
    }

    async has(key: K) {
        return this.inner.withLock(async map => {
            return map.has(key);
        });
    }

    async add(value: V) {
        await this.inner.withLock(async map => {
            map.set(this.key(value), value);
            await this.save(map);
        });

        return this;
    }

    async forEach(callbackfn: (value: V, key: K, map: Map<K, V>) => void, thisArg?: any) {
        return this.inner.withLock(async map => {
            return map.forEach(callbackfn, thisArg)
        })
    }

    async get(key: K) {
        return this.inner.withLock(async map => {
            return map.get(key);
        });
    }

    async size() {
        return this.inner.withLock(async map => {
            return map.size
        });
    }

    async delete(key: K) {
        return this.inner.withLock(async map => {
            const deleted = map.delete(key);
            await this.save(map);
            return deleted;
        });
    }

    async clear() {
        return this.inner.withLock(async map => {
            map.clear();
            await this.save(map);
        });
    }

    async entries() {
        return this.inner.withLock(async map => {
            return map.entries();
        });
    }

    async keys() {
        return this.inner.withLock(async map => {
            return map.keys();
        });
    }

    async values() {
        return this.inner.withLock(async map => {
            return map.values();
        });
    }
}

export class NonObjectQueueMap<K extends PropertyKey, V extends NonObject> {
    private inner: Queue<Map<K, V>> = new Queue(new Map());

    constructor(
        private path: PathLike | FileHandle,
    ) {}

    async load() {
        console.log("Loading map");

        await this.inner.withLock(async map => {
            try {
                const data = await fs.promises.readFile(this.path, 'utf8');
                const parsed = JSON.parse(data) as Record<K, V>;

                map.clear();

                for (const [key, value] of Object.entries(parsed) as [K, V][]) {
                    map.set(key, value)
                }
            } catch (e: NodeJS.ErrnoException | unknown) {
                if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;

                await fs.promises.writeFile(this.path, JSON.stringify([]), 'utf8');
                map.clear();
            }
        });

        return this;
    }

    private async save(map: Map<K, V>) {
        const object: Record<string, V> = Object.fromEntries(map.entries());

        await fs.promises.writeFile(
            this.path,
            JSON.stringify(object, null, 2),
            "utf-8"
        )
    }

    async has(key: K) {
        return this.inner.withLock(async map => {
            return map.has(key);
        });
    }

    async set(key: K, value: V) {
        await this.inner.withLock(async map => {
            map.set(key, value);
            await this.save(map);
        });

        return this;
    }

    async forEach(callbackfn: (value: V, key: K, map: Map<K, V>) => void, thisArg?: any) {
        return this.inner.withLock(async map => {
            return map.forEach(callbackfn, thisArg)
        })
    }

    async get(key: K) {
        return this.inner.withLock(async map => {
            return map.get(key);
        });
    }

    async size() {
        return this.inner.withLock(async map => {
            return map.size
        });
    }

    async delete(key: K) {
        return this.inner.withLock(async map => {
            const deleted = map.delete(key);
            await this.save(map);
            return deleted;
        });
    }

    async clear() {
        return this.inner.withLock(async map => {
            map.clear();
            await this.save(map);
        });
    }

    async entries() {
        return this.inner.withLock(async map => {
            return map.entries();
        });
    }

    async keys() {
        return this.inner.withLock(async map => {
            return map.keys();
        });
    }

    async values() {
        return this.inner.withLock(async map => {
            return map.values();
        });
    }
}