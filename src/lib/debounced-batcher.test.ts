import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { DebouncedBatcher } from "./debounced-batcher";

describe("DebouncedBatcher — coalesce a burst of pushes into one batch", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("flushes every pushed item as one array after `delayMs` of quiet", async () => {
    const flush = vi.fn().mockResolvedValue(undefined);
    const batcher = new DebouncedBatcher<number>(1000, flush);

    batcher.push(1);
    batcher.push(2);
    batcher.push(3);

    await vi.advanceTimersByTimeAsync(999);
    expect(flush).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(flush).toHaveBeenCalledTimes(1);
    // All items, in push order — not just the latest.
    expect(flush).toHaveBeenCalledWith([1, 2, 3]);
  });

  it("each push resets the timer — fires once the burst stops", async () => {
    const flush = vi.fn().mockResolvedValue(undefined);
    const batcher = new DebouncedBatcher<string>(500, flush);

    batcher.push("a");
    await vi.advanceTimersByTimeAsync(400);
    batcher.push("b");
    await vi.advanceTimersByTimeAsync(499);
    expect(flush).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(flush).toHaveBeenCalledTimes(1);
    expect(flush).toHaveBeenCalledWith(["a", "b"]);
  });

  it("flush() drains the queue immediately and cancels the timer", async () => {
    const flush = vi.fn().mockResolvedValue(undefined);
    const batcher = new DebouncedBatcher<number>(500, flush);

    batcher.push(7);
    batcher.push(8);
    await batcher.flush();
    expect(flush).toHaveBeenCalledTimes(1);
    expect(flush).toHaveBeenCalledWith([7, 8]);

    // No second fire from the cancelled timer.
    await vi.advanceTimersByTimeAsync(1000);
    expect(flush).toHaveBeenCalledTimes(1);
  });

  it("is a no-op when nothing is queued", async () => {
    const flush = vi.fn().mockResolvedValue(undefined);
    const batcher = new DebouncedBatcher<number>(500, flush);

    await batcher.flush();
    expect(flush).not.toHaveBeenCalled();
  });

  it("starts a fresh batch after a flush (no carry-over)", async () => {
    const flush = vi.fn().mockResolvedValue(undefined);
    const batcher = new DebouncedBatcher<number>(500, flush);

    batcher.push(1);
    await batcher.flush();
    batcher.push(2);
    await batcher.flush();

    expect(flush).toHaveBeenNthCalledWith(1, [1]);
    expect(flush).toHaveBeenNthCalledWith(2, [2]);
  });
});
