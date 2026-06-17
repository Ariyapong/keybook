import { render } from "ink-testing-library";
import { describe, expect, it } from "vitest";
import { Footer } from "../src/tui/Footer";

describe("Footer", () => {
  it("shows the filter and star hints and the result count", () => {
    const { lastFrame } = render(<Footer flash="" errorCount={0} resultCount={7} />);
    const out = lastFrame() ?? "";
    expect(out).toContain("⌃F filter");
    expect(out).toContain("⌃S star");
    expect(out).toContain("⎋ quit");
    expect(out).toContain("(7)");
  });

  it("swaps ⎋ quit → ⎋ clear filter when a filter is active", () => {
    const { lastFrame } = render(<Footer flash="" errorCount={0} resultCount={3} filterActive />);
    const out = lastFrame() ?? "";
    expect(out).toContain("⎋ clear filter");
    expect(out).not.toContain("⎋ quit");
  });
});
