import { describe, expect, it } from "vitest";
import {
  type Draft,
  draftToEntryInput,
  emptyDraft,
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
