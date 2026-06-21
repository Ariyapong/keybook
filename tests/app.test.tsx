import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { render } from "ink-testing-library";
import { describe, expect, it, vi } from "vitest";
import { loadEntries } from "../src/data/loader";
import type { LoadedEntry } from "../src/data/types";
import { App } from "../src/tui/App";
import { tmpDataDir } from "./_helpers";

const entries: LoadedEntry[] = [
  {
    app: "Finder",
    action: "Open a new tab",
    keys: "⌘T",
    tags: ["new tab"],
    file: "finder.yaml",
    index: 0,
  },
  { app: "Terminal", action: "Clear screen", keys: "⌘K", file: "terminal.yaml", index: 0 },
  {
    app: "Finder",
    action: "Open Terminal here",
    steps: ["Right-click"],
    command: 'open -a Terminal "$PWD"',
    file: "finder.yaml",
    index: 1,
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

  it("adds an entry to an existing app via ⌃O, reloads, and flashes success", async () => {
    const dir = tmpDataDir({
      "fork.yaml": 'app: Fork\nentries:\n  - action: Pull\n    keys: "⇧⌘L"\n',
    });
    const { entries } = loadEntries(dir);
    const { lastFrame, stdin } = render(<App entries={entries} dataDir={dir} />);
    await tick();
    stdin.write("\x0f"); // ⌃O -> add form (App field, "Fork" highlighted at index 0)
    await tick();
    stdin.write("\r"); // ⏎ -> Type
    await tick();
    stdin.write("\x0e"); // ⌃N -> Action
    await tick();
    stdin.write("Force push"); // action
    await tick();
    stdin.write("\x0e"); // ⌃N -> Keys
    await tick();
    stdin.write("cmd shift k"); // keys
    await tick();
    stdin.write("\r"); // review
    await tick();
    stdin.write("\r"); // confirm -> write + reload + flash
    await tick();
    const out = lastFrame() ?? "";
    expect(out).toContain("Force push"); // reloaded results contain the new action
    expect(out).toContain("✓"); // success flash
  });

  it("edits the selected entry on ⌃E and reflects the change after reload", async () => {
    const dir = tmpDataDir({
      "fork.yaml": 'app: Fork\nentries:\n  - action: Pull\n    keys: "⇧⌘L"\n',
    });
    const { entries } = loadEntries(dir);
    const { lastFrame, stdin } = render(<App entries={entries} dataDir={dir} />);
    await tick();
    stdin.write("\x05"); // ⌃E -> edit form (only entry "Pull" is selected)
    await tick();
    expect(lastFrame()).toContain("Edit entry");
    expect(lastFrame()).toContain("Pull");
    stdin.write("\x0e"); // ⌃N: Type -> Action
    await tick();
    stdin.write(" (rebase)");
    await tick();
    stdin.write("\r"); // review
    await tick();
    stdin.write("\r"); // confirm -> editEntry + reload + flash
    await tick();
    const out = lastFrame() ?? "";
    expect(out).toContain("Pull (rebase)");
    expect(out).toContain("✓");
  });

  it("deletes the selected entry on ⌃X then y, leaving the sibling", async () => {
    const dir = tmpDataDir({
      "fork.yaml":
        'app: Fork\nentries:\n  - action: Pull\n    keys: "⇧⌘L"\n  - action: Push\n    keys: "⇧⌘P"\n',
    });
    const { entries } = loadEntries(dir);
    const { lastFrame, stdin } = render(<App entries={entries} dataDir={dir} />);
    await tick();
    // Browse order sorts by app then action: "Pull" < "Push", so index 0 = Pull.
    stdin.write("\x18"); // ⌃X -> arm confirm
    await tick();
    expect(lastFrame()).toContain("Delete 'Fork: Pull'?");
    expect(lastFrame()).toContain("y / n");
    stdin.write("y"); // confirm
    await tick();
    const out = lastFrame() ?? "";
    // The success flash ("✗ deleted 'Pull'") echoes the word "Pull", so assert on
    // the deleted entry's KEYS (⇧⌘L only ever appeared on the Pull row) instead.
    expect(out).not.toContain("⇧⌘L");
    expect(out).toContain("Push");
    expect(out).toContain("✗ deleted");
  });

  it("cancels the delete on any other key", async () => {
    const dir = tmpDataDir({
      "fork.yaml": 'app: Fork\nentries:\n  - action: Pull\n    keys: "⇧⌘L"\n',
    });
    const { entries } = loadEntries(dir);
    const { lastFrame, stdin } = render(<App entries={entries} dataDir={dir} />);
    await tick();
    stdin.write("\x18"); // ⌃X
    await tick();
    stdin.write("n"); // cancel
    await tick();
    expect(lastFrame()).toContain("Pull");
    expect(lastFrame()).not.toContain("Delete 'Fork");
  });

  it("cancels the armed delete on esc without quitting (handler ordering)", async () => {
    const dir = tmpDataDir({
      "fork.yaml": 'app: Fork\nentries:\n  - action: Pull\n    keys: "⇧⌘L"\n',
    });
    const { entries } = loadEntries(dir);
    const { lastFrame, stdin } = render(<App entries={entries} dataDir={dir} />);
    await tick();
    stdin.write("\x18"); // ⌃X -> arm confirm
    await tick();
    expect(lastFrame()).toContain("Delete 'Fork: Pull'?");
    stdin.write("\x1b"); // esc -> must cancel the delete, NOT quit the app
    await tick();
    const out = lastFrame() ?? "";
    expect(out).not.toContain("Delete 'Fork"); // confirm dismissed
    expect(out).toContain("Pull"); // entry still present
    expect(out).toContain("search:"); // app still rendered (did not exit)
  });

  it("⌃E and ⌃X are no-ops when there are no results", async () => {
    const dir = tmpDataDir({
      "fork.yaml": 'app: Fork\nentries:\n  - action: Pull\n    keys: "⇧⌘L"\n',
    });
    const { entries } = loadEntries(dir);
    const { lastFrame, stdin } = render(<App entries={entries} dataDir={dir} />);
    await tick();
    stdin.write("zzzzz"); // no matches
    await tick();
    expect(lastFrame()).toContain("No matches");
    stdin.write("\x05"); // ⌃E
    await tick();
    stdin.write("\x18"); // ⌃X
    await tick();
    expect(lastFrame()).not.toContain("Edit entry");
    expect(lastFrame()).not.toContain("Delete '");
  });

  it("moves the selected entry to another app via the edit form", async () => {
    const dir = tmpDataDir({
      "fork.yaml": 'app: Fork\nentries:\n  - action: Pull\n    keys: "⇧⌘L"\n',
      "git.yaml": 'app: Git\nentries:\n  - action: Status\n    keys: "g s"\n',
    });
    const { entries } = loadEntries(dir);
    const { lastFrame, stdin } = render(<App entries={entries} dataDir={dir} />);
    await tick();
    // Browse order (app then action): Fork:Pull < Git:Status, so index 0 = Fork:Pull.
    stdin.write("\x05"); // ⌃E -> edit form (focus on Type)
    await tick();
    expect(lastFrame()).toContain("Edit entry");
    stdin.write("\x10"); // ⌃P: Type(1) -> App(0)  [validates the floor=0 change]
    await tick();
    stdin.write("\x1b[B"); // ↓: Fork -> Git
    await tick();
    stdin.write("\r"); // App ⏎ -> Type
    await tick();
    stdin.write("\r"); // Type ⏎ -> Action
    await tick();
    stdin.write("\r"); // Action ⏎ -> review
    await tick();
    expect(lastFrame()).toContain("git.yaml"); // review shows the move destination
    stdin.write("\r"); // confirm -> moveEntry + reload
    await tick();
    const { entries: after, errors } = loadEntries(dir);
    expect(errors).toEqual([]);
    expect(
      after
        .filter((e) => e.app === "Git")
        .map((e) => e.action)
        .sort(),
    ).toEqual(["Pull", "Status"]);
    expect(after.some((e) => e.app === "Fork")).toBe(false); // source emptied -> unlinked
  });
});

const tickA = () => new Promise((r) => setTimeout(r, 30));

function dirWithEntries(): string {
  const dir = mkdtempSync(join(tmpdir(), "kb-app-"));
  writeFileSync(
    join(dir, "fork.yaml"),
    'app: Fork\nentries:\n  - action: Force push\n    keys: "⇧⌘P"\n  - action: Pull\n    keys: "⌘L"\n',
    "utf8",
  );
  writeFileSync(
    join(dir, "vscode.yaml"),
    'app: VS Code\nentries:\n  - action: Command Palette\n    keys: "⌘⇧P"\n',
    "utf8",
  );
  return dir;
}

describe("App — filter & favorites", () => {
  it("⌃S stars the current row, flashes, and a reload still shows it", async () => {
    const dir = dirWithEntries();
    const { entries } = loadEntries(dir);
    const { stdin, lastFrame } = render(<App entries={entries} dataDir={dir} />);
    await tickA();
    stdin.write("\x13"); // ⌃S on the first row
    await tickA();
    const out = lastFrame() ?? "";
    expect(out).toContain("★ "); // marker appeared
    expect(out).toContain("★ starred"); // flash
    // a fresh App over the same dir (simulated reload) still sees the star
    const r2 = render(<App entries={loadEntries(dir).entries} dataDir={dir} />);
    await tickA();
    expect(r2.lastFrame() ?? "").toContain("★ ");
  });

  it("⌃F opens the filter picker", async () => {
    const dir = dirWithEntries();
    const { stdin, lastFrame } = render(<App entries={loadEntries(dir).entries} dataDir={dir} />);
    await tickA();
    stdin.write("\x06"); // ⌃F
    await tickA();
    const out = lastFrame() ?? "";
    expect(out).toContain("Filter by app");
    expect(out).toContain("★ Favorites");
  });

  it("selecting an app scopes the list and shows the indicator", async () => {
    const dir = dirWithEntries();
    const { stdin, lastFrame } = render(<App entries={loadEntries(dir).entries} dataDir={dir} />);
    await tickA();
    stdin.write("\x06"); // ⌃F
    await tickA();
    stdin.write("VS"); // narrow to VS Code
    await tickA();
    stdin.write("\r"); // select it
    await tickA();
    const out = lastFrame() ?? "";
    expect(out).toContain("(filter: VS Code)");
    expect(out).toContain("VS Code · Command Palette");
    expect(out).not.toContain("Fork · Force push");
  });

  it("esc clears an active filter before quitting", async () => {
    const dir = dirWithEntries();
    const { stdin, lastFrame } = render(<App entries={loadEntries(dir).entries} dataDir={dir} />);
    await tickA();
    stdin.write("\x06"); // ⌃F
    await tickA();
    stdin.write("\x1b[B"); // ↓ to All apps then... actually select an app to set a filter
    await tickA();
    // pick Fork via typing for determinism
    // (reopen path) — simpler: cancel, then assert esc clears once a filter exists
    stdin.write("\x1b"); // cancel picker
    await tickA();
    // set a favorites filter via the picker
    stdin.write("\x06");
    await tickA();
    stdin.write("\r"); // ★ Favorites (first row)
    await tickA();
    expect(lastFrame() ?? "").toContain("(★ Favorites)");
    stdin.write("\x1b"); // esc clears the filter (does NOT quit)
    await tickA();
    expect(lastFrame() ?? "").not.toContain("(★ Favorites)");
  });
});
