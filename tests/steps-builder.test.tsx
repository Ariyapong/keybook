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

  it("marks the selected step and the grabbed step", () => {
    const sel = render(
      <StepsBuilder steps={["a", "b", "c"]} line="" active cursor={1} grabbed={false} />,
    );
    expect(sel.lastFrame() ?? "").toContain("> 2. b");
    const grab = render(<StepsBuilder steps={["a", "b", "c"]} line="" active cursor={1} grabbed />);
    expect(grab.lastFrame() ?? "").toContain("⇅ 2. b");
  });

  it("shows reorder hints when a step is selected vs grabbed", () => {
    const onStep = render(<StepsBuilder steps={["a", "b"]} line="" active cursor={0} />);
    expect(onStep.lastFrame() ?? "").toMatch(/grab/);
    const grabbed = render(<StepsBuilder steps={["a", "b"]} line="" active cursor={0} grabbed />);
    expect(grabbed.lastFrame() ?? "").toMatch(/drop/);
  });
});
