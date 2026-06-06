import { describe, expect, it } from "vitest";
import {
  type Draft,
  draftToEntryInput,
  emptyDraft,
  entryToDraft,
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
