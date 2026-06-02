import { render } from "ink-testing-library";
import { describe, expect, it, vi } from "vitest";
import { loadEntries } from "../src/data/loader";
import type { Entry } from "../src/data/types";
import { App } from "../src/tui/App";
import { tmpDataDir } from "./_helpers";

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

  it("deletes the previous word on Option+Backspace (meta+delete)", async () => {
    const { lastFrame, stdin } = render(<App entries={entries} />);
    await tick();
    stdin.write("clear new");
    await tick();
    // Ink reports Option+Backspace as Escape-prefixed Delete (0x7f).
    stdin.write("\x1b\x7f");
    await tick();
    // Ink strips trailing whitespace from rendered lines, so we can't assert
    // on the trailing space; assert the substantive behavior — "clear" stays,
    // the trailing word "new" is gone.
    expect(lastFrame()).toContain("search: clear");
    expect(lastFrame()).not.toContain("clear new");
  });

  it("deletes the previous word on Ctrl+W", async () => {
    const { lastFrame, stdin } = render(<App entries={entries} />);
    await tick();
    stdin.write("clear new");
    await tick();
    stdin.write("\x17"); // Ctrl+W
    await tick();
    expect(lastFrame()).toContain("search: clear");
    expect(lastFrame()).not.toContain("clear new");
  });

  it("clears the entire query on Ctrl+U", async () => {
    const { lastFrame, stdin } = render(<App entries={entries} />);
    await tick();
    stdin.write("anything goes");
    await tick();
    stdin.write("\x15"); // Ctrl+U
    await tick();
    expect(lastFrame()).toContain("search:");
    expect(lastFrame()).not.toContain("anything");
  });

  it("still deletes a single character on plain Backspace (regression)", async () => {
    const { lastFrame, stdin } = render(<App entries={entries} />);
    await tick();
    stdin.write("clear");
    await tick();
    stdin.write("\x7f"); // Backspace
    await tick();
    expect(lastFrame()).toContain("search: clea");
    expect(lastFrame()).not.toMatch(/search: clear[^\w]/);
  });

  it("opens the add form on ⌃O and search input goes inert", async () => {
    const dir = tmpDataDir({
      "fork.yaml": 'app: Fork\nentries:\n  - action: Pull\n    keys: "⇧⌘L"\n',
    });
    const { entries } = loadEntries(dir);
    const { lastFrame, stdin } = render(<App entries={entries} dataDir={dir} />);
    await tick();
    stdin.write("\x0f"); // ⌃O
    await tick();
    expect(lastFrame()).toContain("keybook add");
    stdin.write("zzz"); // would be a search query if search were active
    await tick();
    expect(lastFrame()).not.toContain("search: zzz");
  });

  it("returns to search on esc without writing", async () => {
    const dir = tmpDataDir({
      "fork.yaml": 'app: Fork\nentries:\n  - action: Pull\n    keys: "⇧⌘L"\n',
    });
    const { entries } = loadEntries(dir);
    const { lastFrame, stdin } = render(<App entries={entries} dataDir={dir} />);
    await tick();
    stdin.write("\x0f"); // ⌃O
    await tick();
    stdin.write("\x1b"); // esc
    await tick();
    expect(lastFrame()).toContain("search:");
  });
});
