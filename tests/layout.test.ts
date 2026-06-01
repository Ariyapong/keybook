import { describe, expect, it } from "vitest";
import { RESERVED_ROWS, columnWidths, visibleListHeight } from "../src/tui/layout";

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

describe("columnWidths", () => {
  it("always sums to the terminal width (no overflow on odd widths)", () => {
    for (const cols of [80, 114, 115, 116, 117, 200, 201]) {
      const { left, right } = columnWidths(cols);
      expect(left + right).toBe(cols);
    }
  });

  it("splits roughly in half", () => {
    expect(columnWidths(116)).toEqual({ left: 58, right: 58 });
    expect(columnWidths(115)).toEqual({ left: 57, right: 58 });
  });

  it("falls back to a sane default when columns is unknown", () => {
    expect(columnWidths(undefined)).toEqual({ left: 40, right: 40 });
    expect(columnWidths(0)).toEqual({ left: 40, right: 40 });
  });
});
