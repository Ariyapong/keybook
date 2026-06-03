import { render } from "ink-testing-library";
import { describe, expect, it } from "vitest";
import { StepsBuilder } from "../src/tui/StepsBuilder";

describe("StepsBuilder", () => {
  it("renders numbered steps and the active line", () => {
    const { lastFrame } = render(
      <StepsBuilder steps={["Open menu", "Click save"]} line="type me" active />,
    );
    const out = lastFrame() ?? "";
    expect(out).toContain("1. Open menu");
    expect(out).toContain("2. Click save");
    expect(out).toContain("type me");
  });
  it("shows a hint when there are no steps", () => {
    const { lastFrame } = render(<StepsBuilder steps={[]} line="" active />);
    expect(lastFrame() ?? "").toMatch(/⏎ adds a step/);
  });
});
