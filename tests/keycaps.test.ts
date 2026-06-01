import { describe, expect, it } from "vitest";
import { parseKeys } from "../src/tui/keycaps";

describe("parseKeys", () => {
  it("splits modifiers and the final key", () => {
    expect(parseKeys("⌘T")).toEqual([["⌘", "T"]]);
    expect(parseKeys("⌘⌥T")).toEqual([["⌘", "⌥", "T"]]);
    expect(parseKeys("⌘⇧4")).toEqual([["⌘", "⇧", "4"]]);
  });
  it("handles chord sequences split by comma", () => {
    expect(parseKeys("⌃A, C")).toEqual([["⌃", "A"], ["C"]]);
    expect(parseKeys('⌃B, "')).toEqual([["⌃", "B"], ['"']]);
  });
  it("keeps multi-char key names whole", () => {
    expect(parseKeys("Space")).toEqual([["Space"]]);
    expect(parseKeys("F12")).toEqual([["F12"]]);
  });
  it("never throws on odd input", () => {
    expect(parseKeys("???")).toEqual([["???"]]);
  });
});
