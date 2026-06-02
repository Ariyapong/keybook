import { describe, expect, it } from "vitest";
import { deleteWordBack } from "../src/tui/input";

describe("deleteWordBack", () => {
  it("returns empty string for empty input", () => {
    expect(deleteWordBack("")).toBe("");
  });

  it("drops the trailing word when there is no trailing whitespace", () => {
    expect(deleteWordBack("terminal delete")).toBe("terminal ");
  });

  it("drops trailing whitespace AND the word before it in one call", () => {
    expect(deleteWordBack("terminal delete ")).toBe("terminal ");
  });

  it("collapses multiple trailing spaces with the previous word", () => {
    expect(deleteWordBack("terminal delete   ")).toBe("terminal ");
  });

  it("returns empty string when the input is only whitespace", () => {
    expect(deleteWordBack("   ")).toBe("");
  });

  it("handles a single word with no spaces", () => {
    expect(deleteWordBack("terminal")).toBe("");
  });

  it("preserves leading whitespace if a word follows it", () => {
    expect(deleteWordBack("  terminal")).toBe("  ");
  });
});
