import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ensureDataDir, resolveDataDir } from "../src/config";
import { tmpDataDir } from "./_helpers";

describe("resolveDataDir", () => {
  it("prefers KEYBOOK_DATA_DIR", () => {
    expect(resolveDataDir({ KEYBOOK_DATA_DIR: "/custom" })).toEqual({
      dir: "/custom",
      source: "env",
    });
  });
  it("falls back to XDG_CONFIG_HOME", () => {
    expect(resolveDataDir({ XDG_CONFIG_HOME: "/xdg" })).toEqual({
      dir: "/xdg/keybook",
      source: "xdg",
    });
  });
  it("defaults to ~/.config/keybook", () => {
    const r = resolveDataDir({});
    expect(r.source).toBe("default");
    expect(r.dir).toMatch(/\.config\/keybook$/);
  });
});

describe("ensureDataDir", () => {
  it("initializes an empty/missing dir from seed", () => {
    const seed = tmpDataDir({ "a.yaml": 'app: A\nentries:\n  - action: X\n    keys: "A"\n' });
    const target = join(mkdtempSync(join(tmpdir(), "kb-")), "data"); // does not exist yet
    const res = ensureDataDir(target, seed);
    expect(res).toEqual({ initialized: true, fileCount: 1 });
    expect(existsSync(join(target, "a.yaml"))).toBe(true);
  });

  it("does not overwrite an existing data dir", () => {
    const seed = tmpDataDir({ "a.yaml": 'app: A\nentries:\n  - action: X\n    keys: "A"\n' });
    const target = tmpDataDir({ "mine.yaml": 'app: M\nentries:\n  - action: X\n    keys: "A"\n' });
    const res = ensureDataDir(target, seed);
    expect(res.initialized).toBe(false);
    expect(existsSync(join(target, "a.yaml"))).toBe(false);
    rmSync(target, { recursive: true, force: true });
  });
});
