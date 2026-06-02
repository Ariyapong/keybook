import { render } from "ink-testing-library";
import { describe, expect, it, vi } from "vitest";
import type { AddResult } from "../src/data/types";
import { AddEntryForm } from "../src/tui/AddEntryForm";

const ok: AddResult = {
  ok: true,
  file: "/x/fork.yaml",
  created: false,
  lines: ["✓ added to fork.yaml"],
};
const tick = () => new Promise((r) => setTimeout(r, 30));

function setup(onSubmit = vi.fn(() => ok)) {
  const onComplete = vi.fn();
  const onCancel = vi.fn();
  const r = render(
    <AddEntryForm
      apps={["Fork"]}
      onSubmit={onSubmit}
      onComplete={onComplete}
      onCancel={onCancel}
    />,
  );
  return { ...r, onSubmit, onComplete, onCancel };
}

describe("AddEntryForm", () => {
  it("shows the live glyph preview while typing keys", async () => {
    const { stdin, lastFrame } = setup();
    await tick();
    stdin.write("\x0e"); // ⌃N -> Type
    await tick();
    stdin.write("\x10"); // ⌃P -> back to App; choose Fork is index 0 already
    await tick();
    // move to Action (field 2): ⌃N twice from App
    stdin.write("\x0e"); // Type
    await tick();
    stdin.write("\x0e"); // Action
    await tick();
    stdin.write("Push");
    await tick();
    stdin.write("\x0e"); // Keys
    await tick();
    stdin.write("shift cmd p");
    await tick();
    expect(lastFrame() ?? "").toContain("⇧⌘P");
  });

  it("does not call onSubmit until the review is confirmed, then exactly once", async () => {
    const { stdin, onSubmit, onComplete } = setup();
    await tick();
    stdin.write("\x0e"); // App -> Type
    await tick();
    stdin.write("\x0e"); // Type -> Action
    await tick();
    stdin.write("Push");
    await tick();
    stdin.write("\x0e"); // Keys
    await tick();
    stdin.write("shift cmd p");
    await tick();
    expect(onSubmit).not.toHaveBeenCalled();
    stdin.write("\r"); // go to review
    await tick();
    stdin.write("\r"); // confirm
    await tick();
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith(ok);
  });

  it("cancels on esc", async () => {
    const { stdin, onCancel } = setup();
    await tick();
    stdin.write("\x1b"); // esc
    await tick();
    expect(onCancel).toHaveBeenCalled();
  });
});
