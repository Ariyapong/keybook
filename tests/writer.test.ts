import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadEntries } from "../src/data/loader";
import {
  addEntry,
  deleteEntry,
  editEntry,
  listApps,
  moveEntry,
  resolveTargetFile,
} from "../src/data/writer";
import { tmpDataDir } from "./_helpers";

const FORK = `app: Fork
entries:
  - action: Pull
    keys: "⇧⌘L"
    tags: [pull]
`;

describe("listApps", () => {
  it("returns sorted, de-duped app names", () => {
    const dir = tmpDataDir({
      "fork.yaml": FORK,
      "z.yaml": "app: Zed\nentries:\n  - action: X\n    keys: a\n",
    });
    expect(listApps(dir)).toEqual(["Fork", "Zed"]);
  });
  it("includes apps from files whose entries are invalid, as long as app is readable", () => {
    const dir = tmpDataDir({ "broken.yaml": "app: Broken\nentries:\n  - notAField: 1\n" });
    expect(listApps(dir)).toEqual(["Broken"]);
  });
});

describe("resolveTargetFile", () => {
  it("returns the existing file for a known app and a fresh slug for a new one, without writing", () => {
    const dir = tmpDataDir({ "fork.yaml": FORK });
    const before = readdirSync(dir).sort();

    const known = resolveTargetFile(dir, "Fork");
    expect(basename(known.file)).toBe("fork.yaml");
    expect(known.created).toBe(false);

    const fresh = resolveTargetFile(dir, "My App");
    expect(basename(fresh.file)).toBe("my-app.yaml");
    expect(fresh.created).toBe(true);

    // Nothing was written.
    expect(readdirSync(dir).sort()).toEqual(before);
  });
});

describe("addEntry — append to existing", () => {
  it("appends a valid entry and round-trips through loadEntries", () => {
    const dir = tmpDataDir({ "fork.yaml": FORK });
    const res = addEntry(dir, "Fork", { action: "Push", keys: "⇧⌘P", tags: ["push"] });
    expect(res.ok).toBe(true);
    expect(res.created).toBe(false);
    const { entries, errors } = loadEntries(dir);
    expect(errors).toEqual([]);
    expect(entries.find((e) => e.action === "Push")?.keys).toBe("⇧⌘P");
  });
  it("matches the app case- and whitespace-insensitively", () => {
    const dir = tmpDataDir({ "fork.yaml": FORK });
    const res = addEntry(dir, "  fork ", { action: "Push", keys: "⇧⌘P" });
    expect(res.ok).toBe(true);
    expect(res.file.endsWith("fork.yaml")).toBe(true);
  });
});

describe("addEntry — create new app", () => {
  it("creates <slug>.yaml with the right shape and no app field on the entry", () => {
    const dir = tmpDataDir({});
    const res = addEntry(dir, "My App", { action: "Open", command: "open ." });
    expect(res.ok).toBe(true);
    expect(res.created).toBe(true);
    expect(res.file.endsWith("my-app.yaml")).toBe(true);
    const text = readFileSync(join(dir, "my-app.yaml"), "utf8");
    expect(text).toContain("app: My App");
    const { entries, errors } = loadEntries(dir);
    expect(errors).toEqual([]);
    expect(entries[0]).toMatchObject({ app: "My App", action: "Open", command: "open ." });
  });
});

describe("addEntry — validation", () => {
  it("rejects an entry with none of keys/steps/command, without writing", () => {
    const dir = tmpDataDir({ "fork.yaml": FORK });
    const before = readFileSync(join(dir, "fork.yaml"), "utf8");
    const res = addEntry(dir, "Fork", { action: "Nothing" });
    expect(res.ok).toBe(false);
    expect(res.lines.join(" ")).toMatch(/keys, steps, command/);
    expect(readFileSync(join(dir, "fork.yaml"), "utf8")).toBe(before);
  });
});

describe("addEntry — preservation & edge cases", () => {
  it("preserves comments and leaves existing entries semantically identical", () => {
    const withComment = `# my notes\napp: Nano\nentries:\n  - action: Save\n    keys: "⌃O"\n`;
    const dir = tmpDataDir({ "nano.yaml": withComment });
    const before = loadEntries(dir).entries;
    const res = addEntry(dir, "Nano", { action: "Quit", keys: "⌃X" });
    expect(res.ok).toBe(true);
    const text = readFileSync(join(dir, "nano.yaml"), "utf8");
    expect(text).toContain("# my notes"); // comment survives
    const after = loadEntries(dir).entries;
    // existing entry unchanged as parsed
    expect(after.find((e) => e.action === "Save")).toEqual(before.find((e) => e.action === "Save"));
  });

  it("avoids overwriting an unrelated file by suffixing the slug", () => {
    const dir = tmpDataDir({
      "fork.yaml": "app: ForkLift\nentries:\n  - action: X\n    keys: a\n",
    });
    const before = readFileSync(join(dir, "fork.yaml"), "utf8");
    const res = addEntry(dir, "Fork", { action: "Push", keys: "⇧⌘P" });
    expect(res.ok).toBe(true);
    expect(res.created).toBe(true);
    expect(res.file.endsWith("fork-2.yaml")).toBe(true);
    expect(readFileSync(join(dir, "fork.yaml"), "utf8")).toBe(before); // untouched
  });

  it("rejects an entry that carries an app field with a friendly message", () => {
    const dir = tmpDataDir({});
    const res = addEntry(dir, "Fork", { action: "X", keys: "a", app: "Fork" } as never);
    expect(res.ok).toBe(false);
    expect(res.lines.join(" ")).toMatch(/must not have an app field/);
  });
});

const TWO = `app: Fork
entries:
  - action: Pull
    keys: "⇧⌘L"
  # keep me
  - action: Push
    keys: "⇧⌘P"
`;

describe("deleteEntry", () => {
  it("removes the entry at index, preserving siblings and comments", () => {
    const dir = tmpDataDir({ "fork.yaml": TWO });
    const res = deleteEntry(dir, "fork.yaml", 0, "Pull");
    expect(res.ok).toBe(true);
    const text = readFileSync(join(dir, "fork.yaml"), "utf8");
    expect(text).toContain("# keep me");
    const { entries, errors } = loadEntries(dir);
    expect(errors).toEqual([]);
    expect(entries.map((e) => e.action)).toEqual(["Push"]);
  });

  it("unlinks the file when the last entry is deleted", () => {
    const dir = tmpDataDir({
      "solo.yaml": 'app: Solo\nentries:\n  - action: Only\n    keys: "A"\n',
    });
    const res = deleteEntry(dir, "solo.yaml", 0, "Only");
    expect(res.ok).toBe(true);
    expect(existsSync(join(dir, "solo.yaml"))).toBe(false);
    expect(loadEntries(dir).errors).toEqual([]);
  });

  it("aborts on drift (expectedAction mismatch) without writing", () => {
    const dir = tmpDataDir({ "fork.yaml": TWO });
    const before = readFileSync(join(dir, "fork.yaml"), "utf8");
    const res = deleteEntry(dir, "fork.yaml", 0, "Nope");
    expect(res.ok).toBe(false);
    expect(res.lines.join(" ")).toMatch(/changed on disk/);
    expect(readFileSync(join(dir, "fork.yaml"), "utf8")).toBe(before);
  });

  it("returns an error for a missing file", () => {
    const dir = tmpDataDir({});
    expect(deleteEntry(dir, "nope.yaml", 0, "X").ok).toBe(false);
  });
});

describe("editEntry", () => {
  const PAIR = `app: Fork
entries:
  - action: Pull
    keys: "⇧⌘L"
  # second
  - action: Push
    keys: "⇧⌘P"
`;

  it("replaces the entry in place, preserving siblings and comments", () => {
    const dir = tmpDataDir({ "fork.yaml": PAIR });
    const res = editEntry(dir, "fork.yaml", 0, { action: "Pull (rebase)", keys: "⇧⌘L" }, "Pull");
    expect(res.ok).toBe(true);
    const text = readFileSync(join(dir, "fork.yaml"), "utf8");
    expect(text).toContain("# second");
    const { entries, errors } = loadEntries(dir);
    expect(errors).toEqual([]);
    expect(entries.map((e) => e.action)).toEqual(["Pull (rebase)", "Push"]);
    expect(entries.find((e) => e.action === "Push")?.keys).toBe("⇧⌘P");
  });

  it("rejects an invalid edit (no body) without writing", () => {
    const dir = tmpDataDir({ "fork.yaml": PAIR });
    const before = readFileSync(join(dir, "fork.yaml"), "utf8");
    const res = editEntry(dir, "fork.yaml", 0, { action: "Empty" }, "Pull");
    expect(res.ok).toBe(false);
    expect(readFileSync(join(dir, "fork.yaml"), "utf8")).toBe(before);
  });

  it("aborts on drift", () => {
    const dir = tmpDataDir({ "fork.yaml": PAIR });
    const res = editEntry(dir, "fork.yaml", 0, { action: "X", keys: "A" }, "Wrong");
    expect(res.ok).toBe(false);
    expect(res.lines.join(" ")).toMatch(/changed on disk/);
  });

  it("rejects a stray app field", () => {
    const dir = tmpDataDir({ "fork.yaml": PAIR });
    const res = editEntry(
      dir,
      "fork.yaml",
      0,
      { action: "X", keys: "A", app: "Fork" } as never,
      "Pull",
    );
    expect(res.ok).toBe(false);
    expect(res.lines.join(" ")).toMatch(/must not have an app field/);
  });
});

describe("moveEntry", () => {
  const FORK_PAIR = `app: Fork
entries:
  - action: Pull
    keys: "⇧⌘L"
  - action: Push
    keys: "⇧⌘P"
`;
  const GIT = 'app: Git\nentries:\n  - action: Status\n    keys: "g s"\n';

  it("moves an entry to an existing app and removes it from the source", () => {
    const dir = tmpDataDir({ "fork.yaml": FORK_PAIR, "git.yaml": GIT });
    const res = moveEntry(dir, "fork.yaml", 0, "Pull", "Git", { action: "Pull", keys: "⇧⌘L" });
    expect(res.ok).toBe(true);
    const { entries, errors } = loadEntries(dir);
    expect(errors).toEqual([]);
    const byApp = (a: string) => entries.filter((e) => e.app === a).map((e) => e.action);
    expect(byApp("Git")).toEqual(["Status", "Pull"]); // appended to target
    expect(byApp("Fork")).toEqual(["Push"]); // removed from source
  });

  it("moves to a brand-new app, creating the file and unlinking an emptied source", () => {
    const dir = tmpDataDir({
      "fork.yaml": 'app: Fork\nentries:\n  - action: Pull\n    keys: "⇧⌘L"\n',
    });
    const res = moveEntry(dir, "fork.yaml", 0, "Pull", "Slack", { action: "Pull", keys: "⇧⌘L" });
    expect(res.ok).toBe(true);
    expect(res.created).toBe(true);
    expect(existsSync(join(dir, "slack.yaml"))).toBe(true);
    expect(existsSync(join(dir, "fork.yaml"))).toBe(false); // source emptied -> unlinked
    expect(loadEntries(dir).errors).toEqual([]);
  });

  it("aborts with the source untouched when the target add is invalid", () => {
    const dir = tmpDataDir({
      "fork.yaml": 'app: Fork\nentries:\n  - action: Pull\n    keys: "⇧⌘L"\n',
      "git.yaml": GIT,
    });
    const before = readFileSync(join(dir, "fork.yaml"), "utf8");
    const res = moveEntry(dir, "fork.yaml", 0, "Pull", "Git", { action: "Pull" }); // no body -> reject
    expect(res.ok).toBe(false);
    expect(readFileSync(join(dir, "fork.yaml"), "utf8")).toBe(before);
  });

  it("keeps both copies and warns when the source delete drifts", () => {
    const dir = tmpDataDir({
      "fork.yaml": 'app: Fork\nentries:\n  - action: Pull\n    keys: "⇧⌘L"\n',
      "git.yaml": GIT,
    });
    const res = moveEntry(dir, "fork.yaml", 0, "WRONG", "Git", { action: "Pull", keys: "⇧⌘L" });
    expect(res.ok).toBe(true);
    expect(res.lines.join(" ")).toMatch(/still in/);
    expect(loadEntries(dir).entries.filter((e) => e.action === "Pull").length).toBe(2);
  });

  it("delegates to an in-place edit when the target resolves to the source file", () => {
    const dir = tmpDataDir({
      "fork.yaml": 'app: Fork\nentries:\n  - action: Pull\n    keys: "⇧⌘L"\n',
    });
    const res = moveEntry(dir, "fork.yaml", 0, "Pull", "fork", {
      action: "Pull (rebase)",
      keys: "⇧⌘L",
    });
    expect(res.ok).toBe(true);
    const { entries } = loadEntries(dir);
    expect(entries.map((e) => e.action)).toEqual(["Pull (rebase)"]); // edited in place, not duplicated
  });
});
