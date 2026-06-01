import { describe, expect, it } from "vitest";
import { runCheck, runPath } from "../src/commands";
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
