import { render } from "ink-testing-library";
import { describe, expect, it, vi } from "vitest";
import type { Entry } from "../src/data/types";
import { App } from "../src/tui/App";

const entries: Entry[] = [
  { app: "Finder", action: "Open a new tab", keys: "⌘T", tags: ["new tab"] },
  { app: "Terminal", action: "Clear screen", keys: "⌘K" },
  {
    app: "Finder",
    action: "Open Terminal here",
    steps: ["Right-click"],
    command: 'open -a Terminal "$PWD"',
  },
];

// Ink's useInput registers its stdin listener in an effect that flushes after
// commit, and re-registers on each render. Await a tick after render and after
// every keystroke so the listener is in place and state has settled.
const tick = () => new Promise((resolve) => setTimeout(resolve, 20));

describe("App", () => {
  it("lists all entries initially", async () => {
    const { lastFrame } = render(<App entries={entries} />);
    await tick();
    expect(lastFrame()).toContain("Open a new tab");
    expect(lastFrame()).toContain("Clear screen");
  });

  it("filters as you type", async () => {
    const { lastFrame, stdin } = render(<App entries={entries} />);
    await tick();
    stdin.write("clear");
    await tick();
    expect(lastFrame()).toContain("Clear screen");
    expect(lastFrame()).not.toContain("Open a new tab");
  });

  it("shows a no-matches state", async () => {
    const { lastFrame, stdin } = render(<App entries={entries} />);
    await tick();
    stdin.write("zzzzzz");
    await tick();
    expect(lastFrame()).toContain("No matches");
  });

  it("copies the selected entry's keys on Enter", async () => {
    const onCopy = vi.fn(() => true);
    const { lastFrame, stdin } = render(<App entries={entries} onCopy={onCopy} />);
    await tick();
    stdin.write("clear"); // narrows selection to the Terminal "Clear screen" (⌘K) entry
    await tick();
    stdin.write("\r");
    await tick();
    expect(onCopy).toHaveBeenCalledWith("⌘K");
    expect(lastFrame()).toContain("copied");
  });

  it("copies the command for a recipe entry on Enter", async () => {
    const onCopy = vi.fn(() => true);
    const { stdin } = render(<App entries={entries} onCopy={onCopy} />);
    await tick();
    stdin.write("terminal here");
    await tick();
    stdin.write("\r");
    await tick();
    expect(onCopy).toHaveBeenCalledWith('open -a Terminal "$PWD"');
  });
});
