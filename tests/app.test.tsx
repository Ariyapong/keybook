import { render } from "ink-testing-library";
import { describe, expect, it, vi } from "vitest";
import type { Entry } from "../src/data/types";
import { App } from "../src/tui/App";

const entries: Entry[] = [
  { app: "Finder", action: "Open a new tab", keys: "⌘T", tags: ["new tab"] },
  { app: "Terminal", action: "Clear screen", keys: "⌘K" },
  { app: "Finder", action: "Open Terminal here", steps: ["Right-click"], command: 'open -a Terminal "$PWD"' },
];

describe("App", () => {
  it("lists all entries initially", () => {
    const { lastFrame } = render(<App entries={entries} />);
    expect(lastFrame()).toContain("Open a new tab");
    expect(lastFrame()).toContain("Clear screen");
  });

  it("filters as you type", () => {
    const { lastFrame, stdin } = render(<App entries={entries} />);
    stdin.write("clear");
    expect(lastFrame()).toContain("Clear screen");
    expect(lastFrame()).not.toContain("Open a new tab");
  });

  it("shows a no-matches state", () => {
    const { lastFrame, stdin } = render(<App entries={entries} />);
    stdin.write("zzzzzz");
    expect(lastFrame()).toContain("No matches");
  });

  it("copies the selected entry's keys on Enter", () => {
    const onCopy = vi.fn(() => true);
    const { lastFrame, stdin } = render(<App entries={entries} onCopy={onCopy} />);
    stdin.write("clear"); // narrows selection to the Terminal "Clear screen" (⌘K) entry
    stdin.write("\r");
    expect(onCopy).toHaveBeenCalledWith("⌘K");
    expect(lastFrame()).toContain("copied");
  });

  it("copies the command for a recipe entry on Enter", () => {
    const onCopy = vi.fn(() => true);
    const { stdin } = render(<App entries={entries} onCopy={onCopy} />);
    stdin.write("terminal here");
    stdin.write("\r");
    expect(onCopy).toHaveBeenCalledWith('open -a Terminal "$PWD"');
  });
});
