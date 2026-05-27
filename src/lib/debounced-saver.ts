/**
 * Collapse a stream of `push(payload)` calls into a single `save(payload)`
 * call that fires after `delayMs` of quiet, OR immediately via `flush()`.
 * Latest payload wins.
 *
 * Used by ADR-0005 debounced-autosave consumers — orbit camera (#14), and
 * (in future) note body (#18) once that lands.
 */
export class DebouncedSaver<T> {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pending: T | null = null;
  private pendingSet = false;

  constructor(
    private readonly delayMs: number,
    private readonly save: (payload: T) => Promise<void> | void,
  ) {}

  push(payload: T): void {
    this.pending = payload;
    this.pendingSet = true;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      this.fire();
    }, this.delayMs);
  }

  async flush(): Promise<void> {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    await this.fire();
  }

  private async fire(): Promise<void> {
    if (!this.pendingSet) return;
    const payload = this.pending as T;
    this.pending = null;
    this.pendingSet = false;
    await this.save(payload);
  }
}
