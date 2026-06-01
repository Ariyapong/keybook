import { describe, expect, it } from "vitest";
import { entrySchema, fileShape } from "../src/data/schema";

describe("entrySchema", () => {
  it("accepts a key-combo entry", () => {
    expect(entrySchema.safeParse({ action: "New tab", keys: "⌘T" }).success).toBe(true);
  });
  it("accepts a recipe entry (steps only)", () => {
    expect(entrySchema.safeParse({ action: "X", steps: ["a", "b"] }).success).toBe(true);
  });
  it("accepts a command-only entry", () => {
    expect(entrySchema.safeParse({ action: "X", command: "open ." }).success).toBe(true);
  });
  it("rejects an entry with none of keys/steps/command", () => {
    expect(entrySchema.safeParse({ action: "X" }).success).toBe(false);
  });
  it("rejects unknown fields", () => {
    expect(entrySchema.safeParse({ action: "X", keys: "⌘T", foo: 1 }).success).toBe(false);
  });
});

describe("fileShape", () => {
  it("requires app and a non-empty entries array", () => {
    expect(fileShape.safeParse({ entries: [] }).success).toBe(false);
    expect(fileShape.safeParse({ app: "Finder", entries: [{}] }).success).toBe(true);
  });
});
