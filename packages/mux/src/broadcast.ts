/** An unbounded async FIFO: push values, fail with an error, or close cleanly. */
class AsyncQueue<T> {
  private values: T[] = [];
  private waiters: { resolve: (r: IteratorResult<T>) => void; reject: (e: unknown) => void }[] = [];
  private done = false;
  private failed = false;
  private error: unknown;

  push(value: T): void {
    const waiter = this.waiters.shift();
    if (waiter) waiter.resolve({ value, done: false });
    else this.values.push(value);
  }

  close(): void {
    this.done = true;
    let waiter = this.waiters.shift();
    while (waiter) {
      waiter.resolve({ value: undefined as never, done: true });
      waiter = this.waiters.shift();
    }
  }

  /** Surface `err` to consumers once their buffered values have drained. */
  fail(err: unknown): void {
    this.failed = true;
    this.error = err;
    let waiter = this.waiters.shift();
    while (waiter) {
      waiter.reject(err);
      waiter = this.waiters.shift();
    }
  }

  [Symbol.asyncIterator](): AsyncIterator<T> {
    return {
      next: () => {
        if (this.values.length) return Promise.resolve({ value: this.values.shift() as T, done: false });
        if (this.failed) return Promise.reject(this.error);
        if (this.done) return Promise.resolve({ value: undefined as never, done: true });
        return new Promise((resolve, reject) => { this.waiters.push({ resolve, reject }); });
      },
    };
  }
}

/**
 * Fan one async-iterable out to `n` independent consumers. A single pump reads
 * the source once and enqueues each item to every consumer's queue, so consumers
 * observe every item and may pull at different rates (queues buffer the lag). If
 * the source throws, buffered items drain first and then the error surfaces from
 * each consumer's iterator; a clean end closes each queue.
 */
export function broadcast<T>(source: AsyncIterable<T>, n: number): AsyncIterable<T>[] {
  if (n === 0) return [];
  const queues = Array.from({ length: n }, () => new AsyncQueue<T>());
  (async () => {
    try {
      for await (const item of source) for (const q of queues) q.push(item);
      for (const q of queues) q.close();
    } catch (err) {
      for (const q of queues) q.fail(err);
    }
  })();
  return queues;
}
