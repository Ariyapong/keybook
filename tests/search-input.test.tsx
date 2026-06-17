import { render } from "ink-testing-library";
import { describe, expect, it } from "vitest";
import { SearchInput } from "../src/tui/SearchInput";

describe("SearchInput", () => {
  it("renders the query", () => {
    const { lastFrame } = render(<SearchInput query="rebase" />);
    expect(lastFrame() ?? "").toContain("search: rebase");
  });

  it("renders a right-aligned filter label when provided", () => {
    const { lastFrame } = render(<SearchInput query="" filterLabel="(filter: Fork)" />);
    expect(lastFrame() ?? "").toContain("(filter: Fork)");
  });

  it("omits the label when none is provided", () => {
    const { lastFrame } = render(<SearchInput query="x" />);
    expect(lastFrame() ?? "").not.toContain("filter:");
  });
});
