import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  favKey,
  favoritesPath,
  loadFavorites,
  saveFavorites,
  toggleFavorite,
} from "../src/data/favorites";

const tmp = () => mkdtempSync(join(tmpdir(), "kb-fav-"));

describe("favorites store", () => {
  it("favKey is stable and round-trips app/action", () => {
    expect(favKey("Fork", "Force push")).toBe(favKey("Fork", "Force push"));
    expect(favKey("Fork", "Force push")).not.toBe(favKey("Fork", "Pull"));
  });

  it("loadFavorites returns an empty set when the file is missing", () => {
    expect(loadFavorites(tmp()).size).toBe(0);
  });

  it("loadFavorites returns an empty set when the file is malformed", () => {
    const dir = tmp();
    writeFileSync(favoritesPath(dir), "not json{", "utf8");
    expect(loadFavorites(dir).size).toBe(0);
  });

  it("toggleFavorite adds, persists, and reloads", () => {
    const dir = tmp();
    const after = toggleFavorite(dir, "Fork", "Force push");
    expect(after.has(favKey("Fork", "Force push"))).toBe(true);
    expect(loadFavorites(dir).has(favKey("Fork", "Force push"))).toBe(true);
  });

  it("toggleFavorite removes on the second call", () => {
    const dir = tmp();
    toggleFavorite(dir, "Fork", "Force push");
    const after = toggleFavorite(dir, "Fork", "Force push");
    expect(after.has(favKey("Fork", "Force push"))).toBe(false);
    expect(loadFavorites(dir).size).toBe(0);
  });

  it("saveFavorites writes valid JSON and leaves no .tmp residue", () => {
    const dir = tmp();
    saveFavorites(dir, new Set([favKey("VS Code", "Command Palette")]));
    expect(existsSync(`${favoritesPath(dir)}.tmp`)).toBe(false);
    const data = JSON.parse(readFileSync(favoritesPath(dir), "utf8"));
    expect(data).toEqual({
      version: 1,
      favorites: [{ app: "VS Code", action: "Command Palette" }],
    });
  });
});
