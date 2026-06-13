import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadEntries } from "../src/data/loader";

const SEED = join(process.cwd(), "seed");

describe("seed data", () => {
  it("is all structurally valid (zero load errors)", () => {
    const { errors } = loadEntries(SEED);
    expect(errors).toEqual([]);
  });

  it("has a useful number of entries", () => {
    const { entries } = loadEntries(SEED);
    expect(entries.length).toBeGreaterThan(50);
  });

  it("covers every seeded app", () => {
    const { entries } = loadEntries(SEED);
    const apps = new Set(entries.map((e) => e.app));
    for (const a of [
      "Finder",
      "Terminal",
      "VS Code",
      "Microsoft Edge",
      "Fork",
      "tmux",
      "macOS",
      "Claude",
      "Text editing",
      "Vim",
      "Nano",
      "Git",
      "Google Chrome",
      "Safari",
      "JetBrains",
    ]) {
      expect(apps.has(a)).toBe(true);
    }
  });
});
