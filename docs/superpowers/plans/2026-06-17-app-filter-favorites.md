# App Filter + Favorites Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an app-filter picker (`⌃F`) and persistent favorites (`⌃S` + `★`) to the keybook TUI, so the 353-entry seed is navigable and personalizable.

**Architecture:** A new pure data module (`src/data/favorites.ts`) persists favorites to `favorites.json` in the data dir, keyed by `app+action`. A new full-view mode (`mode:"filter"`) renders a `FilterPicker`. `App.tsx` gains `filter` + `favorites` state and a scoped list pipeline (`entries → filter → search`). Presentational components (`ResultRow`, `ResultList`, `SearchInput`, `Footer`) gain small props for the `★` marker, the filter indicator, and the new footer hints. No schema/loader/writer changes.

**Tech Stack:** TypeScript (strict, ESM), Ink (React for the terminal), Vitest + ink-testing-library, fzf, Node 22.

**Reference spec:** `docs/superpowers/specs/2026-06-17-app-filter-favorites-design.md`

**Conventions:**
- macOS glyphs: `⌘ ⌥ ⌃ ⇧ ⏎ ⎋ ⌫ ⇥ ␣ ↑ ↓ ← →`. Modifier order command-first (`⌘⇧`), matching existing files.
- One commit per task; plain conventional-commits messages, NO co-author/attribution trailer (project rule).
- Run all commands from the repo root. After each task, `pnpm test` must stay green.
- `search<T extends Entry>(entries: T[], query): T[]` preserves the element type — keep `LoadedEntry` flowing through the pipeline.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/data/favorites.ts` | **New.** `favKey`, `loadFavorites`, `saveFavorites` (atomic), `toggleFavorite`, `favoritesPath`. |
| `src/tui/FilterPicker.tsx` | **New.** Full-view picker: pinned `★ Favorites`/`All apps` header + windowed sorted apps, type-to-filter, `⏎`/`esc`/`⌃F`. Exports the `Filter` type. |
| `src/tui/ResultRow.tsx` | **Modify.** Add `favorite?: boolean` → 2-cell `★ `/`  ` slot after the gutter. |
| `src/tui/ResultList.tsx` | **Modify.** Add `favorites?: Set<string>` (per-row star) + `emptyMessage?: string`. |
| `src/tui/SearchInput.tsx` | **Modify.** Add `filterLabel?: string` → right-aligned indicator, cursor preserved. |
| `src/tui/Footer.tsx` | **Modify.** Add `⌃F filter`/`⌃S star`; `filterActive?: boolean` swaps `⎋ quit`→`⎋ clear filter`. |
| `src/tui/App.tsx` | **Modify.** `filter`+`favorites` state, `mode:"filter"`, scoped pipeline, `⌃F`/`⌃S`/`esc` handlers, wire children. |
| `tests/favorites.test.ts` | **New.** Unit tests for the store. |
| `tests/filter-picker.test.tsx` | **New.** Render/interaction tests for the picker. |
| `tests/result-list.test.tsx` | **New.** `★` slot + empty-message render tests. |
| `tests/search-input.test.tsx` | **New.** filter-label render test. |
| `tests/footer.test.tsx` | **New.** footer-hint render test. |
| `tests/app.test.tsx` | **Modify.** Integration: `⌃S`, `⌃F`, scoping, `esc`-clear, persistence. |

---

## Task 1: Favorites store — `src/data/favorites.ts`

**Files:**
- Create: `src/data/favorites.ts`
- Create: `tests/favorites.test.ts`

- [ ] **Step 1: Write the failing tests** — `tests/favorites.test.ts`

```ts
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { favKey, loadFavorites, saveFavorites, toggleFavorite, favoritesPath } from "../src/data/favorites";

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
    expect(data).toEqual({ version: 1, favorites: [{ app: "VS Code", action: "Command Palette" }] });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test favorites`
Expected: FAIL — cannot resolve `../src/data/favorites` (module not created).

- [ ] **Step 3: Implement `src/data/favorites.ts`**

```ts
import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// NUL separator: app/action never contain it, so favKey is unambiguous.
const SEP = "\u0000";

export function favKey(app: string, action: string): string {
  return `${app}${SEP}${action}`;
}

export function favoritesPath(dir: string): string {
  return join(dir, "favorites.json");
}

interface FavFile {
  version: number;
  favorites: { app: string; action: string }[];
}

/** Read favorites.json → Set of favKeys. Missing/malformed → empty set (never throws). */
export function loadFavorites(dir: string): Set<string> {
  const set = new Set<string>();
  try {
    const data = JSON.parse(readFileSync(favoritesPath(dir), "utf8")) as FavFile;
    const list = Array.isArray(data?.favorites) ? data.favorites : [];
    for (const f of list) {
      if (f && typeof f.app === "string" && typeof f.action === "string") {
        set.add(favKey(f.app, f.action));
      }
    }
  } catch {
    // missing or malformed — treat as empty
  }
  return set;
}

/** Atomic write (temp + rename) of the favKey set back to favorites.json. */
export function saveFavorites(dir: string, keys: Set<string>): void {
  const favorites = [...keys].map((k) => {
    const i = k.indexOf(SEP);
    return { app: k.slice(0, i), action: k.slice(i + 1) };
  });
  const data: FavFile = { version: 1, favorites };
  const path = favoritesPath(dir);
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  renameSync(tmp, path);
}

/** Toggle one favorite, persist, and return the new set. */
export function toggleFavorite(dir: string, app: string, action: string): Set<string> {
  const keys = loadFavorites(dir);
  const k = favKey(app, action);
  if (keys.has(k)) keys.delete(k);
  else keys.add(k);
  saveFavorites(dir, keys);
  return keys;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test favorites`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/data/favorites.ts tests/favorites.test.ts
git commit -m "feat(favorites): persistent favorites store (favorites.json, atomic)"
```

---

## Task 2: `★` marker — `ResultRow` + `ResultList`

**Files:**
- Modify: `src/tui/ResultRow.tsx`
- Modify: `src/tui/ResultList.tsx`
- Create: `tests/result-list.test.tsx`

- [ ] **Step 1: Write the failing tests** — `tests/result-list.test.tsx`

```tsx
import { render } from "ink-testing-library";
import { describe, expect, it } from "vitest";
import type { LoadedEntry } from "../src/data/types";
import { favKey } from "../src/data/favorites";
import { ResultList } from "../src/tui/ResultList";

const E = (app: string, action: string, keys?: string): LoadedEntry => ({
  app, action, keys, file: `${app}.yaml`, index: 0,
});

describe("ResultList", () => {
  it("renders a ★ on favorited rows and a blank slot otherwise", () => {
    const results = [E("Fork", "Force push", "⇧⌘P"), E("VS Code", "Command Palette", "⌘⇧P")];
    const favorites = new Set([favKey("Fork", "Force push")]);
    const { lastFrame } = render(
      <ResultList results={results} selected={0} query="" favorites={favorites} />,
    );
    const out = lastFrame() ?? "";
    expect(out).toContain("★ Fork · Force push");
    expect(out).toContain("VS Code · Command Palette");
    expect(out).not.toContain("★ VS Code");
  });

  it("shows the custom empty message when there are no results", () => {
    const { lastFrame } = render(
      <ResultList results={[]} selected={0} query="" emptyMessage="No favorites yet — ⌃S stars an entry." />,
    );
    expect(lastFrame() ?? "").toContain("No favorites yet");
  });

  it("falls back to the no-matches message without an emptyMessage", () => {
    const { lastFrame } = render(<ResultList results={[]} selected={0} query="zzz" />);
    expect(lastFrame() ?? "").toContain('No matches for "zzz"');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test result-list`
Expected: FAIL — `ResultList` doesn't accept `favorites`/`emptyMessage`; `★` not rendered.

- [ ] **Step 3: Update `src/tui/ResultRow.tsx`**

```tsx
import { Box, Text } from "ink";
import type { Entry } from "../data/types";

export function ResultRow({
  entry,
  selected,
  favorite = false,
}: {
  entry: Entry;
  selected: boolean;
  favorite?: boolean;
}) {
  const right = entry.keys ?? "recipe";
  // wrap="truncate-end" forces this row to stay on one line even if the
  // entry's app+action text is wider than the column. Without it, long
  // entries wrap to 2 lines, the rendered frame exceeds the terminal
  // height, and Ink's in-place redraw leaves stale lines on every
  // keystroke (see layout.ts comments).
  return (
    <Box>
      <Text wrap="truncate-end">
        <Text color={selected ? "cyan" : undefined} inverse={selected}>
          {selected ? "▸ " : "  "}
          {favorite ? "★ " : "  "}
          {entry.app} · {entry.action}
        </Text>
        <Text color="gray"> {right}</Text>
      </Text>
    </Box>
  );
}
```

- [ ] **Step 4: Update `src/tui/ResultList.tsx`**

```tsx
import { Box, Text } from "ink";
import { favKey } from "../data/favorites";
import type { Entry } from "../data/types";
import { ResultRow } from "./ResultRow";

export function ResultList({
  results,
  selected,
  query,
  height = 12,
  width = "50%",
  favorites,
  emptyMessage,
}: {
  results: Entry[];
  selected: number;
  query: string;
  height?: number;
  width?: number | string;
  favorites?: Set<string>;
  emptyMessage?: string;
}) {
  if (results.length === 0) {
    return (
      <Box width={width} justifyContent="center">
        <Text color="gray">{emptyMessage ?? `No matches for "${query}"`}</Text>
      </Box>
    );
  }
  const start = Math.max(0, Math.min(selected - Math.floor(height / 2), results.length - height));
  const visible = results.slice(Math.max(0, start), Math.max(0, start) + height);
  return (
    <Box flexDirection="column" width={width}>
      {visible.map((e, i) => (
        <ResultRow
          key={`${e.app}:${e.action}`}
          entry={e}
          selected={Math.max(0, start) + i === selected}
          favorite={favorites?.has(favKey(e.app, e.action)) ?? false}
        />
      ))}
    </Box>
  );
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm test result-list`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/tui/ResultRow.tsx src/tui/ResultList.tsx tests/result-list.test.tsx
git commit -m "feat(tui): render ★ marker for favorited rows + custom empty message"
```

---

## Task 3: filter indicator — `SearchInput`

**Files:**
- Modify: `src/tui/SearchInput.tsx`
- Create: `tests/search-input.test.tsx`

- [ ] **Step 1: Write the failing test** — `tests/search-input.test.tsx`

```tsx
import { render } from "ink-testing-library";
import { describe, expect, it } from "vitest";
import { SearchInput } from "../src/tui/SearchInput";

describe("SearchInput", () => {
  it("renders the query", () => {
    const { lastFrame } = render(<SearchInput query="rebase" />);
    expect(lastFrame() ?? "").toContain("search: rebase");
  });

  it("renders a right-aligned filter label when provided", () => {
    const { lastFrame } = render(<SearchInput query="" filterLabel="(filter: Fork)" />);
    expect(lastFrame() ?? "").toContain("(filter: Fork)");
  });

  it("omits the label when none is provided", () => {
    const { lastFrame } = render(<SearchInput query="x" />);
    expect(lastFrame() ?? "").not.toContain("filter:");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test search-input`
Expected: FAIL — `SearchInput` doesn't accept `filterLabel`.

- [ ] **Step 3: Update `src/tui/SearchInput.tsx`**

```tsx
import { Box, Text } from "ink";

export function SearchInput({ query, filterLabel }: { query: string; filterLabel?: string }) {
  // justifyContent="space-between" pushes the filter label to the right edge
  // while the query+cursor stay on the left. Both children use truncate-end so
  // the line never wraps to a second row (which would break Ink's in-place
  // redraw — see ResultRow/Footer/layout.ts).
  return (
    <Box justifyContent="space-between">
      <Text wrap="truncate-end">
        <Text color="cyan">search: </Text>
        <Text>{query}</Text>
        <Text inverse> </Text>
      </Text>
      {filterLabel ? (
        <Text color="gray" wrap="truncate-end">
          {filterLabel}
        </Text>
      ) : null}
    </Box>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test search-input`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/tui/SearchInput.tsx tests/search-input.test.tsx
git commit -m "feat(tui): right-aligned filter indicator in the search input"
```

---

## Task 4: footer hints — `Footer`

**Files:**
- Modify: `src/tui/Footer.tsx`
- Create: `tests/footer.test.tsx`

- [ ] **Step 1: Write the failing test** — `tests/footer.test.tsx`

```tsx
import { render } from "ink-testing-library";
import { describe, expect, it } from "vitest";
import { Footer } from "../src/tui/Footer";

describe("Footer", () => {
  it("shows the filter and star hints and the result count", () => {
    const { lastFrame } = render(<Footer flash="" errorCount={0} resultCount={7} />);
    const out = lastFrame() ?? "";
    expect(out).toContain("⌃F filter");
    expect(out).toContain("⌃S star");
    expect(out).toContain("⎋ quit");
    expect(out).toContain("(7)");
  });

  it("swaps ⎋ quit → ⎋ clear filter when a filter is active", () => {
    const { lastFrame } = render(<Footer flash="" errorCount={0} resultCount={3} filterActive />);
    const out = lastFrame() ?? "";
    expect(out).toContain("⎋ clear filter");
    expect(out).not.toContain("⎋ quit");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test footer`
Expected: FAIL — hints/`filterActive` not present.

- [ ] **Step 3: Update `src/tui/Footer.tsx`**

```tsx
import { Box, Text } from "ink";

export function Footer({
  flash,
  errorCount,
  resultCount,
  confirm,
  filterActive = false,
}: {
  flash: string;
  errorCount: number;
  resultCount: number;
  confirm?: string;
  filterActive?: boolean;
}) {
  // wrap="truncate-end" keeps the line within the frame even when wide-glyph
  // keycaps (⌘⌥⌃⇧⏎⎋⌫) render as 2 cells. A wrapped line overflows the height
  // and Ink's in-place redraw breaks (commit 66200d9). The confirm question
  // truncates on the left; the y / n lives in the fixed right cell so it is
  // always visible.
  if (confirm) {
    return (
      <Box marginTop={1} justifyContent="space-between">
        <Text color="yellow" wrap="truncate-end">
          {confirm}
        </Text>
        <Text color="yellow" bold>
          {"  y / n"}
        </Text>
      </Box>
    );
  }
  const quit = filterActive ? "⎋ clear filter" : "⎋ quit";
  return (
    <Box marginTop={1} justifyContent="space-between">
      <Text color="gray" wrap="truncate-end">
        {`↑↓ move ⏎ copy ⌃O add ⌃E edit ⌃X del ⌃F filter ⌃S star ${quit} ⌃U clear (${resultCount})`}
      </Text>
      {flash ? (
        <Text color="green">{flash}</Text>
      ) : errorCount > 0 ? (
        <Text color="yellow">⚠ {errorCount} skipped — run `keybook check`</Text>
      ) : (
        <Text> </Text>
      )}
    </Box>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test footer`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/tui/Footer.tsx tests/footer.test.tsx
git commit -m "feat(tui): footer hints for ⌃F filter / ⌃S star (+ ⎋ clear filter)"
```

---

## Task 5: the picker — `FilterPicker`

**Files:**
- Create: `src/tui/FilterPicker.tsx`
- Create: `tests/filter-picker.test.tsx`

Design notes:
- Logical list is `[★ Favorites, All apps, ...matchingApps]`. The two scope rows are
  **pinned** (always rendered as a header); only the app rows window/scroll beneath them,
  so `All apps` never disappears.
- Typing narrows the app rows (case-insensitive substring) and jumps the highlight to the
  first app (logical index 2) so `⏎` selects an app.
- `↑↓`/`⌃N`/`⌃P` move; `⏎` selects; `esc`/`⌃F` cancel.

- [ ] **Step 1: Write the failing tests** — `tests/filter-picker.test.tsx`

```tsx
import { render } from "ink-testing-library";
import { describe, expect, it, vi } from "vitest";
import { FilterPicker } from "../src/tui/FilterPicker";

const APPS = ["Claude", "Fork", "Notion", "VS Code"];
const tick = () => new Promise((r) => setTimeout(r, 20));

describe("FilterPicker", () => {
  it("renders the pinned scopes and the apps", () => {
    const { lastFrame } = render(
      <FilterPicker apps={APPS} onSelect={vi.fn()} onCancel={vi.fn()} />,
    );
    const out = lastFrame() ?? "";
    expect(out).toContain("★ Favorites");
    expect(out).toContain("All apps");
    expect(out).toContain("Fork");
  });

  it("⏎ on the first row selects the favorites scope", async () => {
    const onSelect = vi.fn();
    const { stdin } = render(<FilterPicker apps={APPS} onSelect={onSelect} onCancel={vi.fn()} />);
    await tick();
    stdin.write("\r");
    await tick();
    expect(onSelect).toHaveBeenCalledWith({ type: "favorites" });
  });

  it("arrow down to All apps and ⏎ selects the all scope", async () => {
    const onSelect = vi.fn();
    const { stdin } = render(<FilterPicker apps={APPS} onSelect={onSelect} onCancel={vi.fn()} />);
    await tick();
    stdin.write("\x1b[B"); // ↓ → All apps
    await tick();
    stdin.write("\r");
    await tick();
    expect(onSelect).toHaveBeenCalledWith({ type: "all" });
  });

  it("typing narrows apps (scopes stay) and ⏎ selects the matched app", async () => {
    const onSelect = vi.fn();
    const { stdin, lastFrame } = render(
      <FilterPicker apps={APPS} onSelect={onSelect} onCancel={vi.fn()} />,
    );
    await tick();
    stdin.write("fo"); // matches "Fork"
    await tick();
    const out = lastFrame() ?? "";
    expect(out).toContain("★ Favorites"); // scope rows still pinned
    expect(out).toContain("Fork");
    expect(out).not.toContain("Claude"); // narrowed out
    stdin.write("\r");
    await tick();
    expect(onSelect).toHaveBeenCalledWith({ type: "app", app: "Fork" });
  });

  it("esc cancels", async () => {
    const onCancel = vi.fn();
    const { stdin } = render(<FilterPicker apps={APPS} onSelect={vi.fn()} onCancel={onCancel} />);
    await tick();
    stdin.write("\x1b"); // esc
    await tick();
    expect(onCancel).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test filter-picker`
Expected: FAIL — `FilterPicker` module not created.

- [ ] **Step 3: Implement `src/tui/FilterPicker.tsx`**

```tsx
import { Box, Text, useInput } from "ink";
import { useMemo, useState } from "react";

export type Filter = { type: "all" } | { type: "app"; app: string } | { type: "favorites" };

export function FilterPicker({
  apps,
  onSelect,
  onCancel,
  height = 16,
}: {
  apps: string[];
  onSelect: (f: Filter) => void;
  onCancel: () => void;
  height?: number;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0); // 0=Favorites, 1=All apps, 2+=apps

  const matchedApps = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? apps.filter((a) => a.toLowerCase().includes(q)) : apps;
  }, [apps, query]);

  const total = 2 + matchedApps.length; // 2 pinned scope rows + apps
  const sel = Math.min(selected, Math.max(0, total - 1));

  useInput((input, key) => {
    if (key.escape || (key.ctrl && input === "f")) return onCancel();
    if (key.downArrow || (key.ctrl && input === "n")) {
      setSelected((s) => Math.min(s + 1, total - 1));
      return;
    }
    if (key.upArrow || (key.ctrl && input === "p")) {
      setSelected((s) => Math.max(s - 1, 0));
      return;
    }
    if (key.return) {
      if (sel === 0) return onSelect({ type: "favorites" });
      if (sel === 1) return onSelect({ type: "all" });
      const app = matchedApps[sel - 2];
      if (app) return onSelect({ type: "app", app });
      return;
    }
    if (key.backspace || key.delete) {
      setQuery((q) => q.slice(0, -1));
      setSelected(0);
      return;
    }
    if (input && !key.ctrl && !key.meta) {
      setQuery((q) => q + input);
      setSelected(2); // jump highlight to the first matching app
    }
  });

  // Window only the app rows; the 2 scope rows are pinned above them.
  const bodyHeight = Math.max(1, height - 2);
  const appSel = Math.max(0, sel - 2);
  const startApp =
    matchedApps.length > bodyHeight
      ? Math.max(0, Math.min(appSel - Math.floor(bodyHeight / 2), matchedApps.length - bodyHeight))
      : 0;
  const visibleApps = matchedApps.slice(startApp, startApp + bodyHeight);

  const row = (text: string, idx: number) => {
    const isSel = idx === sel;
    return (
      <Text key={`${idx}:${text}`} color={isSel ? "cyan" : undefined} inverse={isSel}>
        {isSel ? "▸ " : "  "}
        {text}
      </Text>
    );
  };

  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1}>
      <Text color="cyan">Filter by app</Text>
      <Text>
        {query ? query : <Text color="gray">type to filter…</Text>}
        <Text inverse> </Text>
      </Text>
      {row("★ Favorites", 0)}
      {row("All apps", 1)}
      <Text color="gray">──────────────</Text>
      {visibleApps.map((app, i) => row(app, startApp + i + 2))}
      {matchedApps.length > bodyHeight ? <Text color="gray">  ↓ more</Text> : null}
      <Text color="gray">↑↓ move ⏎ select ⎋ cancel</Text>
    </Box>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test filter-picker`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/tui/FilterPicker.tsx tests/filter-picker.test.tsx
git commit -m "feat(tui): FilterPicker overlay (pinned scopes + type-to-filter apps)"
```

---

## Task 6: integrate into `App.tsx`

**Files:**
- Modify: `src/tui/App.tsx`
- Modify: `tests/app.test.tsx`

- [ ] **Step 1: Write the failing tests** — append to `tests/app.test.tsx`

These build a real temp data dir so favorites persist. Add at the top of the file (if not
already present) the imports:

```tsx
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadEntries } from "../src/data/loader";
```

Then add this `describe` block:

```tsx
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test app`
Expected: FAIL — `⌃S`/`⌃F` do nothing; no `★`, no `Filter by app`, no `(filter: …)`.

- [ ] **Step 3: Update `src/tui/App.tsx`** — apply these edits.

(a) Imports — add the favorites store and the picker (and its `Filter` type):

```tsx
import { FilterPicker, type Filter } from "./FilterPicker";
import { favKey, loadFavorites, toggleFavorite } from "../data/favorites";
```

(b) Replace the `mode` state line and add `filter` + `favorites`:

```tsx
  const [mode, setMode] = useState<"search" | "add" | "edit" | "filter">("search");
  const [filter, setFilter] = useState<Filter>({ type: "all" });
  const [favorites, setFavorites] = useState<Set<string>>(() =>
    dataDir ? loadFavorites(dataDir) : new Set<string>(),
  );
```

(c) Replace the `results` memo with the scoped pipeline:

```tsx
  const scoped = useMemo(() => {
    if (filter.type === "app") return entries.filter((e) => e.app === filter.app);
    if (filter.type === "favorites")
      return entries.filter((e) => favorites.has(favKey(e.app, e.action)));
    return entries;
  }, [entries, filter, favorites]);
  const results = useMemo(() => search(scoped, query), [scoped, query]);
```

(d) In the search-mode `useInput`, change the `esc` branch to clear an active filter first:

```tsx
      if (key.escape) {
        if (filter.type !== "all") {
          setFilter({ type: "all" });
          setSelected(0);
          return;
        }
        exit();
        return;
      }
```

(e) Add the `⌃F` and `⌃S` handlers right after the `⌃X` delete handler (so they sit with
the other `dataDir`-guarded ctrl actions):

```tsx
      if (key.ctrl && input === "f") {
        setMode("filter");
        return;
      }
      if (dataDir && current && key.ctrl && input === "s") {
        const next = toggleFavorite(dataDir, current.app, current.action);
        setFavorites(next);
        setFlash(next.has(favKey(current.app, current.action)) ? "★ starred" : "☆ unstarred");
        return;
      }
```

(f) Add the filter-mode render branch (place it next to the `add`/`edit` branches, before
the final `return`):

```tsx
  if (mode === "filter") {
    return (
      <FilterPicker
        apps={[...new Set(entries.map((e) => e.app))].sort()}
        height={listHeight}
        onSelect={(f: Filter) => {
          setFilter(f);
          setSelected(0);
          setMode("search");
        }}
        onCancel={() => setMode("search")}
      />
    );
  }
```

(g) Wire the children in the final `return` — update `SearchInput`, `ResultList`, and
`Footer`:

```tsx
      <SearchInput
        query={query}
        filterLabel={
          filter.type === "app"
            ? `(filter: ${filter.app})`
            : filter.type === "favorites"
              ? "(★ Favorites)"
              : undefined
        }
      />
      <Box>
        <ResultList
          results={results}
          selected={sel}
          query={query}
          height={listHeight}
          width={left}
          favorites={favorites}
          emptyMessage={filter.type === "favorites" ? "No favorites yet — ⌃S stars an entry." : undefined}
        />
        <PreviewPane entry={current} width={right} />
      </Box>
      <Footer
        flash={flash}
        errorCount={errorCount}
        resultCount={results.length}
        filterActive={filter.type !== "all"}
        confirm={
          pendingDelete ? `Delete '${pendingDelete.app}: ${pendingDelete.action}'?` : undefined
        }
      />
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test app`
Expected: PASS (existing app tests + the 4 new ones).

- [ ] **Step 5: Run the full suite + typecheck**

Run: `pnpm test && pnpm typecheck`
Expected: all green. (If `Filter` import or `current` typing complains, confirm the import
path `./FilterPicker` and that `current` is `LoadedEntry | undefined` from `results[sel]`.)

- [ ] **Step 6: Commit**

```bash
git add src/tui/App.tsx tests/app.test.tsx
git commit -m "feat(tui): wire app filter + favorites into the search view"
```

---

## Task 7: full verification

**Files:** none (verification only)

- [ ] **Step 1: Full suite**

Run: `pnpm test`
Expected: all suites PASS (favorites, result-list, search-input, footer, filter-picker, app, + existing).

- [ ] **Step 2: Lint + typecheck**

Run: `pnpm lint && pnpm typecheck`
Expected: both clean. (If Biome reformats, run `pnpm format` and re-commit.)

- [ ] **Step 3: Build + seed check (no regressions)**

Run: `pnpm build && KEYBOOK_DATA_DIR="$(mktemp -d)" node dist/cli.js check`
Expected: `✓ 353 entries OK`, exit 0.

- [ ] **Step 4: Real-terminal `⌃S` flow-control check (manual)**

Run `node dist/cli.js` against a throwaway dir (`KEYBOOK_DATA_DIR=$(mktemp -d) node dist/cli.js`), press `⌃S` on a row, and confirm a `★` + `★ starred` flash appear (i.e. the terminal did NOT swallow `⌃S` as XOFF). If it IS swallowed, change the keybinding to `⌃B` in `App.tsx` (the `input === "s"` handler) and the `Footer` hint (`⌃S star` → `⌃B star`), re-run tests, and amend.

- [ ] **Step 5: Commit any formatting fixes (if needed)**

```bash
git add -A
git commit -m "chore(tui): formatting after app filter + favorites"
```

(Skip if nothing changed.)

---

## Self-Review (completed by plan author)

**1. Spec coverage:**
- §4 `⌃F` picker (pinned scopes, type-to-filter, windowed, selection) → Task 5 + Task 6(f). §4 input isolation → FilterPicker owns input in `mode:"filter"`; search `useInput` stays `isActive: mode==="search"` (unchanged) → Task 6.
- §5 `⌃S`/`★`/store/identity → Task 1 (store) + Task 2 (`★`) + Task 6(e) (handler). Instant/reversible toggle (no undo) → matches Task 6(e).
- §6 esc-clears-filter (search-mode only; modal esc unchanged) → Task 6(d).
- §7 state + scoped pipeline → Task 6(b,c). §8 component changes → Tasks 2–6. §9 edge cases: malformed→empty (Task 1), empty-favorites hint (Task 2 + 6g), no-dataDir no-op (Task 6e guard). §11 testing → Tasks 1–6 tests. §12 acceptance → covered across tasks; §13 release is out of plan scope (user-driven).

**2. Placeholder scan:** No TBD/TODO. Every step shows complete code or an exact command + expected output. The Task 6 esc-clear test uses a deterministic favorites-scope path (first-row ⏎) rather than a fragile arrow sequence.

**3. Type consistency:** `Filter` is defined+exported in `FilterPicker.tsx` and imported in `App.tsx` (Task 5 + 6a). `favKey(app, action)` signature is identical in `favorites.ts`, `ResultList.tsx`, and `App.tsx`. `favorites` is `Set<string>` everywhere. `ResultList` gains `favorites?: Set<string>` + `emptyMessage?: string`; `Footer` gains `filterActive?: boolean`; `SearchInput` gains `filterLabel?: string` — all consumed exactly as defined. `search<T extends Entry>` keeps `results: LoadedEntry[]`, so `current.app`/`current.action` are valid for `toggleFavorite`.

**Known simplification (flag at handoff):** the picker pins the two scope rows as a fixed
header and windows only the app rows beneath — faithful to "scope rows never disappear."
Arrow-key windowing of the app sublist is exercised lightly by tests (the 18-app seed fits
a normal-height terminal without scrolling); the windowing math mirrors `ResultList`.
