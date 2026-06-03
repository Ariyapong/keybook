import { describe, expect, it } from "vitest";
import { normalizeKeys } from "../src/data/keys";

describe("normalizeKeys", () => {
  it("turns words into glyphs", () => {
    expect(normalizeKeys("shift cmd p")).toBe("⇧⌘P");
  });
  it("is idempotent on glyph input", () => {
    expect(normalizeKeys("⇧⌘P")).toBe("⇧⌘P");
    expect(normalizeKeys("shift cmd p")).toBe(normalizeKeys("⇧⌘P"));
  });
  it("canonicalizes modifier order to ⌃⌥⇧⌘", () => {
    expect(normalizeKeys("cmd shift ctrl opt a")).toBe("⌃⌥⇧⌘A");
  });
  it("de-dupes repeated modifiers", () => {
    expect(normalizeKeys("shift cmd cmd p")).toBe("⇧⌘P");
  });
  it("accepts + as a separator", () => {
    expect(normalizeKeys("shift+cmd+p")).toBe("⇧⌘P");
  });
  it("maps named keys", () => {
    expect(normalizeKeys("cmd return")).toBe("⌘⏎");
    expect(normalizeKeys("ctrl space")).toBe("⌃␣");
  });
  it("splits chords on comma or 'then' and trims each", () => {
    expect(normalizeKeys("  ctrl b ,  % ")).toBe("⌃B, %");
    expect(normalizeKeys("ctrl b then %")).toBe("⌃B, %");
  });
  it("preserves unrecognized tokens verbatim", () => {
    expect(normalizeKeys("foo")).toBe("foo");
  });
  it("does not uppercase non-letter single-char tokens", () => {
    expect(normalizeKeys(":wq")).toBe(":wq");
  });
});
