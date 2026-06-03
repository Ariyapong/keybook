import { describe, expect, it } from "vitest";
import { runAdd, runCheck, runPath } from "../src/commands";
import { loadEntries } from "../src/data/loader";
import { tmpDataDir } from "./_helpers";

describe("runPath", () => {
  it("includes the resolved dir and its source", () => {
    const out = runPath({ KEYBOOK_DATA_DIR: "/c" });
    expect(out).toContain("/c");
    expect(out).toContain("env");
  });
});

describe("runCheck", () => {
  it("reports ok on valid data", () => {
    const dir = tmpDataDir({ "a.yaml": 'app: A\nentries:\n  - action: X\n    keys: "A"\n' });
    const r = runCheck(dir);
    expect(r.ok).toBe(true);
    expect(r.lines[0]).toContain("OK");
  });

  it("reports failure and lists the offending entry", () => {
    const dir = tmpDataDir({ "a.yaml": "app: A\nentries:\n  - action: Bad\n" });
    const r = runCheck(dir);
    expect(r.ok).toBe(false);
    expect(r.lines[0]).toContain("entry 0");
  });
});

describe("runAdd", () => {
  it("normalizes keys and writes a valid entry", () => {
    const dir = tmpDataDir({
      "fork.yaml": 'app: Fork\nentries:\n  - action: Pull\n    keys: "⇧⌘L"\n',
    });
    const res = runAdd(dir, { app: "Fork", action: "Push", keys: "shift cmd p" });
    expect(res.ok).toBe(true);
    expect(loadEntries(dir).entries.find((e) => e.action === "Push")?.keys).toBe("⇧⌘P");
  });
  it("fails when no keys/steps/command are given", () => {
    const dir = tmpDataDir({});
    const res = runAdd(dir, { app: "Fork", action: "Nothing" });
    expect(res.ok).toBe(false);
  });
});
