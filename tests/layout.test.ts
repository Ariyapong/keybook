import { describe, expect, it } from "vitest";
import { RESERVED_ROWS, visibleListHeight } from "../src/tui/layout";

describe("visibleListHeight", () => {
  it("sizes the list to the terminal height minus fixed chrome", () => {
    expect(visibleListHeight(24)).toBe(24 - RESERVED_ROWS);
    expect(visibleListHeight(40)).toBe(40 - RESERVED_ROWS);
  });

  it("keeps the whole frame within the terminal (search + list + footer <= rows)", () => {
    for (const rows of [8, 12, 20, 50]) {
      // frame = 1 (search) + listHeight + 2 (footer block)
      expect(1 + visibleListHeight(rows) + 2).toBeLessThanOrEqual(rows);
    }
  });

  it("never returns less than 1 row, even on a tiny terminal", () => {
    expect(visibleListHeight(4)).toBe(1);
    expect(visibleListHeight(1)).toBe(1);
  });

  it("falls back to a sane default when rows is unknown", () => {
    expect(visibleListHeight(undefined)).toBe(24 - RESERVED_ROWS);
    expect(visibleListHeight(0)).toBe(24 - RESERVED_ROWS);
  });
});
