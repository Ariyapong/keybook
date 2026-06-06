import { describe, expect, it } from "vitest";
import type { Entry, LoadedEntry } from "../src/data/types";
import { search } from "../src/search";

const entries: Entry[] = [
  { app: "Finder", action: "Open a new tab", keys: "⌘T", tags: ["new tab"] },
  { app: "Terminal", action: "New tab", keys: "⌘T" },
  { app: "VS Code", action: "Toggle terminal", keys: "⌃`" },
];

describe("search", () => {
  it("returns all entries sorted by app then action for an empty query", () => {
    expect(search(entries, "").map((e) => e.app)).toEqual(["Finder", "Terminal", "VS Code"]);
  });

  it("AND-narrows multi-token queries", () => {
    const r = search(entries, "finder tab");
    expect(r.some((e) => e.app === "Finder")).toBe(true);
    expect(r.some((e) => e.app === "Terminal")).toBe(false);
  });

  it("matches via tag synonyms", () => {
    const r = search(entries, "new tab");
    expect(r[0]?.action).toMatch(/tab/i);
  });

  it("preserves LoadedEntry provenance on results", () => {
    const e: LoadedEntry = {
      app: "X",
      action: "Open settings",
      keys: "⌘,",
      file: "x.yaml",
      index: 4,
    };
    const [r] = search([e], "settings");
    expect(r).toMatchObject({ file: "x.yaml", index: 4 });
  });
});
