import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadEntries } from "../src/data/loader";
import { addEntry, listApps } from "../src/data/writer";
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
