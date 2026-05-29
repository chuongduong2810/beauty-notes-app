import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useAppStore } from "../store";
import { ToolPalette } from "./ToolPalette";

describe("ToolPalette — Note / Pen / Eraser mode switch (issue #35)", () => {
  beforeEach(() => {
    useAppStore.setState({
      penState: {
        currentTool: "note",
        pen: { color_id: "paper", width_id: "fine" },
        inProgressStroke: null,
      },
      penSessionAnnotations: {},
      toolbarVisible: true,
    });
  });

  it("renders one pill per tool, with the current tool marked aria-pressed=true", () => {
    render(<ToolPalette />);
    expect(screen.getByRole("button", { name: /note/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: /pen/i })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByRole("button", { name: /eraser/i })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("clicking a pill switches the active tool in the store", () => {
    render(<ToolPalette />);
    fireEvent.click(screen.getByRole("button", { name: /pen/i }));
    expect(useAppStore.getState().penState.currentTool).toBe("pen");
    expect(screen.getByRole("button", { name: /pen/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("clicking 'Hide toolbar' collapses the palette to a restore chip; clicking the chip brings it back", () => {
    render(<ToolPalette />);
    fireEvent.click(screen.getByRole("button", { name: /hide toolbar/i }));
    expect(useAppStore.getState().toolbarVisible).toBe(false);
    // Pills should no longer be rendered.
    expect(screen.queryByRole("button", { name: /pen/i })).toBeNull();
    // Restore chip is present.
    const restore = screen.getByRole("button", { name: /show toolbar/i });
    fireEvent.click(restore);
    expect(useAppStore.getState().toolbarVisible).toBe(true);
    expect(screen.getByRole("button", { name: /pen/i })).toBeInTheDocument();
  });
});
