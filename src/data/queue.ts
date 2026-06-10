export class Queue<T> {
    private queue: Promise<void> = Promise.resolve();

    constructor(private value: T) {}

    async withLock<R>(fn: (value: T) => R | Promise<R>): Promise<R> {
        const run = this.queue.then(() => fn(this.value), () => fn(this.value));
        this.queue = run.then(() => undefined, () => undefined);
        return run;
    }
}