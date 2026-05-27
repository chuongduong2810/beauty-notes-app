import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { DebouncedSaver } from "./debounced-saver";

describe("DebouncedSaver — collapse a stream of save calls into one", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("runs the saved payload once after `delayMs` of quiet", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const saver = new DebouncedSaver<number>(1000, save);

    saver.push(1);
    saver.push(2);
    saver.push(3);

    await vi.advanceTimersByTimeAsync(999);
    expect(save).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(3); // most recent wins
  });

  it("each push resets the timer — the saver only fires after the user stops", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const saver = new DebouncedSaver<string>(500, save);

    saver.push("a");
    await vi.advanceTimersByTimeAsync(400);
    saver.push("b");
    await vi.advanceTimersByTimeAsync(499);
    expect(save).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith("b");
  });

  it("flush() runs the pending save immediately and cancels the timer", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const saver = new DebouncedSaver<number>(500, save);

    saver.push(7);
    await saver.flush();
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(7);

    // No second fire from the cancelled timer.
    await vi.advanceTimersByTimeAsync(1000);
    expect(save).toHaveBeenCalledTimes(1);
  });
});
