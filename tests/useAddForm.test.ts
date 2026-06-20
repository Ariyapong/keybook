import { describe, expect, it } from "vitest";
import {
  type Draft,
  deleteStep,
  draftToEntryInput,
  emptyDraft,
  entryToDraft,
  moveStep,
  parseTags,
  resolvedApp,
  validateDraft,
} from "../src/tui/useAddForm";

const base: Draft = {
  ...emptyDraft,
  app: "Fork",
  action: "Push",
  type: "shortcut",
  keys: "shift cmd p",
};

describe("parseTags", () => {
  it("splits, trims, and drops empties", () => {
    expect(parseTags("push, upload ,  ")).toEqual(["push", "upload"]);
  });
});

describe("resolvedApp", () => {
  it("uses newApp when creating", () => {
    expect(resolvedApp({ ...emptyDraft, creatingApp: true, newApp: " Zed " })).toBe("Zed");
  });
});

describe("validateDraft", () => {
  it("passes for a complete shortcut", () => {
    expect(validateDraft(base)).toBeNull();
  });
  it("requires app and action", () => {
    expect(validateDraft({ ...base, app: "" })).toMatch(/App/);
    expect(validateDraft({ ...base, action: "" })).toMatch(/Action/);
  });
  it("requires keys, command, or a step", () => {
    expect(validateDraft({ ...base, keys: "" })).toMatch(/keys|command|step/i);
  });
  it("treats whitespace-only keys as empty", () => {
    expect(validateDraft({ ...base, keys: "   " })).toMatch(/keys|command|step/i);
  });
});

describe("draftToEntryInput", () => {
  it("normalizes keys and includes only populated fields", () => {
    expect(draftToEntryInput(base)).toEqual({ action: "Push", keys: "⇧⌘P" });
  });
  it("includes steps and tags when present", () => {
    const d: Draft = {
      ...emptyDraft,
      app: "Finder",
      action: "X",
      type: "recipe",
      steps: ["a", "b"],
      tags: "x, y",
    };
    expect(draftToEntryInput(d)).toEqual({ action: "X", steps: ["a", "b"], tags: ["x", "y"] });
  });
});

describe("entryToDraft", () => {
  it("round-trips a shortcut through draftToEntryInput", () => {
    const e = { action: "Push", keys: "⇧⌘P", tags: ["push"] };
    expect(draftToEntryInput(entryToDraft("Fork", e))).toEqual(e);
  });
  it("round-trips a command entry", () => {
    const e = { action: "Open", command: "open ." };
    expect(draftToEntryInput(entryToDraft("Terminal", e))).toEqual(e);
  });
  it("round-trips a recipe entry", () => {
    const e = { action: "Steps", steps: ["a", "b"], notes: "careful" };
    expect(draftToEntryInput(entryToDraft("X", e))).toEqual(e);
  });
  it("preserves an entry that has BOTH keys and command", () => {
    const e = { action: "Both", keys: "⌘K", command: "clear" };
    expect(draftToEntryInput(entryToDraft("X", e))).toEqual(e);
  });
});

describe("moveStep", () => {
  it("moves a step up and down", () => {
    expect(moveStep(["a", "b", "c"], 1, 0)).toEqual(["b", "a", "c"]);
    expect(moveStep(["a", "b", "c"], 1, 2)).toEqual(["a", "c", "b"]);
  });
  it("moves across multiple positions", () => {
    expect(moveStep(["a", "b", "c", "d"], 0, 3)).toEqual(["b", "c", "d", "a"]);
  });
  it("is a no-op at the ends, for same index, and out of range", () => {
    expect(moveStep(["a", "b"], 0, -1)).toEqual(["a", "b"]);
    expect(moveStep(["a", "b"], 1, 2)).toEqual(["a", "b"]);
    expect(moveStep(["a", "b"], 0, 0)).toEqual(["a", "b"]);
  });
});

describe("deleteStep", () => {
  it("removes the step at the index", () => {
    expect(deleteStep(["a", "b", "c"], 1)).toEqual(["a", "c"]);
  });
  it("is a no-op for out-of-range indices", () => {
    expect(deleteStep(["a", "b"], 5)).toEqual(["a", "b"]);
    expect(deleteStep(["a", "b"], -1)).toEqual(["a", "b"]);
  });
  it("is a no-op on an empty array", () => {
    expect(deleteStep([], 0)).toEqual([]);
  });
});
