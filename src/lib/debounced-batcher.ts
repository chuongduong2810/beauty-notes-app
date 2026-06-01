/**
 * Accumulate a stream of `push(item)` calls into a single `flushFn(items)`
 * call that fires after `delayMs` of quiet, OR immediately via `flush()`.
 *
 * Unlike {@link DebouncedSaver} (latest payload wins), this *collects* every
 * pushed item and hands the whole batch to `flushFn` in push order. Used to
 * coalesce a burst of Note creations into one `insertNotes` write so rapidly
 * clicking a wall many times persists in a single round-trip (ADR-0005's
 * debounced-autosave philosophy, applied to creates).
 */
export class DebouncedBatcher<T> {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private queue: T[] = [];

  constructor(
    private readonly delayMs: number,
    private readonly flushFn: (items: T[]) => Promise<void> | void,
  ) {}

  /** Queue one item and (re)start the quiet-period timer. */
  push(item: T): void {
    this.queue.push(item);
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.fire();
    }, this.delayMs);
  }

  /** Flush any queued items immediately (e.g. before a Room switch). */
  async flush(): Promise<void> {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    await this.fire();
  }

  private async fire(): Promise<void> {
    if (this.queue.length === 0) return;
    // Swap the queue out before awaiting so items pushed during the flush
    // accumulate for the next batch rather than being lost or double-sent.
    const items = this.queue;
    this.queue = [];
    await this.flushFn(items);
  }
}
