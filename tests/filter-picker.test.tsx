import { render } from "ink-testing-library";
import { describe, expect, it, vi } from "vitest";
import { FilterPicker } from "../src/tui/FilterPicker";

const APPS = ["Claude", "Fork", "Notion", "VS Code"];
const tick = () => new Promise((r) => setTimeout(r, 20));

describe("FilterPicker", () => {
  it("renders the pinned scopes and the apps", () => {
    const { lastFrame } = render(
      <FilterPicker apps={APPS} onSelect={vi.fn()} onCancel={vi.fn()} />,
    );
    const out = lastFrame() ?? "";
    expect(out).toContain("★ Favorites");
    expect(out).toContain("All apps");
    expect(out).toContain("Fork");
  });

  it("⏎ on the first row selects the favorites scope", async () => {
    const onSelect = vi.fn();
    const { stdin } = render(<FilterPicker apps={APPS} onSelect={onSelect} onCancel={vi.fn()} />);
    await tick();
    stdin.write("\r");
    await tick();
    expect(onSelect).toHaveBeenCalledWith({ type: "favorites" });
  });

  it("arrow down to All apps and ⏎ selects the all scope", async () => {
    const onSelect = vi.fn();
    const { stdin } = render(<FilterPicker apps={APPS} onSelect={onSelect} onCancel={vi.fn()} />);
    await tick();
    stdin.write("\x1b[B"); // ↓ → All apps
    await tick();
    stdin.write("\r");
    await tick();
    expect(onSelect).toHaveBeenCalledWith({ type: "all" });
  });

  it("typing narrows apps (scopes stay) and ⏎ selects the matched app", async () => {
    const onSelect = vi.fn();
    const { stdin, lastFrame } = render(
      <FilterPicker apps={APPS} onSelect={onSelect} onCancel={vi.fn()} />,
    );
    await tick();
    stdin.write("fo"); // matches "Fork"
    await tick();
    const out = lastFrame() ?? "";
    expect(out).toContain("★ Favorites"); // scope rows still pinned
    expect(out).toContain("Fork");
    expect(out).not.toContain("Claude"); // narrowed out
    stdin.write("\r");
    await tick();
    expect(onSelect).toHaveBeenCalledWith({ type: "app", app: "Fork" });
  });

  it("esc cancels", async () => {
    const onCancel = vi.fn();
    const { stdin } = render(<FilterPicker apps={APPS} onSelect={vi.fn()} onCancel={onCancel} />);
    await tick();
    stdin.write("\x1b"); // esc
    await tick();
    expect(onCancel).toHaveBeenCalled();
  });

  it("shows ↓ more at the top and ↑ more once scrolled, when apps overflow", async () => {
    const many = ["A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8"];
    const { stdin, lastFrame } = render(
      <FilterPicker apps={many} height={5} onSelect={vi.fn()} onCancel={vi.fn()} />,
    );
    await tick();
    // bodyHeight = height - 2 = 3; 8 apps overflow → ↓ more at top, no ↑ more yet.
    expect(lastFrame() ?? "").toContain("↓ more");
    expect(lastFrame() ?? "").not.toContain("↑ more");
    for (let i = 0; i < 6; i++) {
      stdin.write("\x1b[B"); // ↓ scroll the app window down
      await tick();
    }
    // scrolled past the top → ↑ more appears.
    expect(lastFrame() ?? "").toContain("↑ more");
  });
});
