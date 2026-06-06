import { render } from "ink-testing-library";
import { describe, expect, it, vi } from "vitest";
import type { AddResult } from "../src/data/types";
import { AddEntryForm } from "../src/tui/AddEntryForm";
import { entryToDraft } from "../src/tui/useAddForm";

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

  it("lets you create a new app and submits with the typed name", async () => {
    const onSubmit = vi.fn(() => ok);
    const { stdin } = setup(onSubmit);
    await tick();
    // Field 0 (App): only "Fork" + "Create new app…" — one downArrow lands on it.
    stdin.write("\x1b[B"); // downArrow -> "Create new app…"
    await tick();
    stdin.write("Zed"); // type the new app name in the revealed input
    await tick();
    stdin.write("\r"); // ⏎ -> advance to Type
    await tick();
    stdin.write("\x0e"); // ⌃N -> Action
    await tick();
    stdin.write("Run"); // action
    await tick();
    stdin.write("\x0e"); // ⌃N -> Keys
    await tick();
    stdin.write("cmd r"); // keys
    await tick();
    stdin.write("\r"); // review
    await tick();
    stdin.write("\r"); // confirm
    await tick();
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith("Zed", expect.objectContaining({ action: "Run" }));
  });

  it("counts a typed-but-not-appended recipe step when entering review", async () => {
    const onSubmit = vi.fn(() => ok);
    const { stdin, lastFrame } = setup(onSubmit);
    await tick();
    // App stays "Fork" (index 0); advance to Type.
    stdin.write("\x0e"); // ⌃N -> Type
    await tick();
    // Type field: shortcut -> command -> recipe via right/space twice.
    stdin.write(" "); // -> command
    await tick();
    stdin.write(" "); // -> recipe
    await tick();
    stdin.write("\x0e"); // ⌃N -> Action
    await tick();
    stdin.write("Open Terminal here"); // action
    await tick();
    stdin.write("\x0e"); // ⌃N -> Steps
    await tick();
    stdin.write("Right-click the folder"); // ONE step line, no ⏎ (left pending)
    await tick();
    stdin.write("\x0e"); // ⌃N -> Tags (pending stepLine stays in the draft)
    await tick();
    stdin.write("\r"); // go to review — pending step is flushed, should NOT error
    await tick();
    const out = lastFrame() ?? "";
    expect(out).toContain("Review");
    expect(out).toContain("Right-click the folder");
    expect(out).not.toContain("at least one step");
  });

  it("pre-fills and locks the app in edit mode", async () => {
    const initial = entryToDraft("Fork", { action: "Push", keys: "⇧⌘P" });
    const { lastFrame } = render(
      <AddEntryForm
        apps={["Fork", "Zed"]}
        lockedApp="Fork"
        initial={initial}
        title="Edit entry — Fork"
        onSubmit={vi.fn(() => ok)}
        onComplete={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    await tick();
    const out = lastFrame() ?? "";
    expect(out).toContain("Edit entry — Fork");
    expect(out).toContain("(locked)");
    expect(out).toContain("Push");
    expect(out).toContain("⇧⌘P");
  });

  it("submits the locked app and edited action on confirm", async () => {
    const onSubmit = vi.fn(() => ok);
    const initial = entryToDraft("Fork", { action: "Push", keys: "⇧⌘P" });
    const { stdin } = render(
      <AddEntryForm
        apps={["Fork"]}
        lockedApp="Fork"
        initial={initial}
        onSubmit={onSubmit}
        onComplete={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    await tick();
    stdin.write("\x0e"); // ⌃N: Type(1) -> Action(2)
    await tick();
    stdin.write(" (force)"); // append to the pre-filled "Push"
    await tick();
    stdin.write("\r"); // review
    await tick();
    stdin.write("\r"); // confirm
    await tick();
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith(
      "Fork",
      expect.objectContaining({ action: "Push (force)", keys: "⇧⌘P" }),
    );
  });
});
