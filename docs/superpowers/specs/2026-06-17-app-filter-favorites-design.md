# keybook app filter + favorites — design spec

| | |
|---|---|
| **Status** | Approved (design), pending spec review |
| **Date** | 2026-06-17 |
| **Target** | TUI search experience (`src/tui/*`, `src/data/favorites.ts`) |
| **Reference** | [v0.1 design spec](2026-06-01-keybook-design.md) §9 (TUI); rendering facts verified against the live render at design time |

---

## 1. Goal

Make the now-large seed (353 entries across 18 apps) navigable and personal:

- **App filter (`⌃F`)** — a picker overlay to scope the result list to a single app.
- **Favorites (`⌃S`)** — star entries you reach for often; a `★ Favorites` scope in the
  same picker shows just those, across all apps.

Both layer on top of the existing fuzzy search without changing fzf ranking or the
YAML data path.

## 2. Non-goals

- No change to the YAML schema, loader, or writer (favorites persist in a *separate*
  JSON file, not in the entry YAML).
- No pin-favorites-to-top reordering of normal results (the `★ Favorites` scope covers
  "see only my favorites").
- No multi-app filter (one scope at a time), no favorites export/sync.
- Not the deferred readline cursor model (`⌃A`/`⌃K`/…) — `⌃A` stays reserved for it.

## 3. Current rendering (ground truth to preserve)

Verified against the live render (100-col terminal → `columnWidths(100)` = left **50** /
right **50**):

- **`SearchInput`** is full width: `search: {query}` followed by an **always-present
  inverse-video block cursor** (a single inverse space), even when the query is empty.
- **`ResultRow`** (left pane, no fixed sub-columns, `wrap="truncate-end"` at col 50):
  `(1)` a 2-char gutter — `▸ ` (cyan+inverse) when selected, two spaces otherwise;
  `(2)` `{app} · {action}` (literal middle-dot ` · `); `(3)` the gray right value as
  ` {right}` — **exactly one space** then `entry.keys ?? "recipe"` (ragged, *not* a
  right-aligned column; there is no fixed column width).
- **`PreviewPane`** (right 50 cols, `paddingLeft={2}` → content indented 2 cells from the
  pane's left edge): app (cyan) / action (bold) / blank / `KeyCaps` / numbered steps /
  gray notes / gray tags. `KeyCaps` render only here: each cap is a round-bordered box
  with `paddingX={1}` (1-cell char → 5 cells `╭───╮`; 2-cell glyph `⌘⌥⌃⇧⏎⎋⌫` → 6 cells
  `╭────╮`), separated by one space. Returns `null` when there is no current entry.
- **`ResultList`** renders centered gray text within the **50-col left pane** when
  `results.length === 0` (the existing "No matches" empty state).
- **`Footer`** is one `truncate-end` line: `↑↓ move ⏎ copy ⌃O add ⌃E edit ⌃X del ⎋ quit ⌃U clear (N)`,
  with a right-hand slot for the flash (`✓ copied!`) / error / `y / n` confirm.

## 4. App filter — `⌃F` picker overlay

`⌃F` (search mode) opens a `FilterPicker` as a new **`mode: "filter"`** so its `useInput`
is isolated from search.

**Contents (top to bottom):** two **pinned** scope rows — **`★ Favorites`** then
**`All apps`** — a thin separator, then every app name (distinct `entries[].app`),
sorted. The pinned rows never disappear.

**Interaction:**
- Type to filter — a case-insensitive substring match narrows only the **app** rows
  below the separator; the two scope rows stay pinned. When the query is non-empty the
  highlight auto-jumps to the first matching app so `⏎` selects an app.
- `↑↓` / `⌃N` / `⌃P` move the highlight; `⏎` selects the highlighted row; `esc` or `⌃F`
  cancels (no change).
- The list is **windowed** (20+ rows won't fit): show a `↓ more` / `↑ more` affordance
  when scrolled.

**Selection result:**
- `All apps` → `filter = { type: "all" }` (clears any active filter).
- an app → `filter = { type: "app", app }`.
- `★ Favorites` → `filter = { type: "favorites" }`.

**Input isolation:** while `mode === "filter"` the `FilterPicker` owns input — only
type-to-filter, `↑↓`/`⌃N`/`⌃P`, `⏎`, and `esc`/`⌃F` do anything. `⌃O`/`⌃E`/`⌃X`/`⌃S` are
search-mode actions and are inert while the picker is open (the search `useInput` is
gated by `isActive: mode === "search"`).

The filter is **ephemeral** — it resets to `{ type: "all" }` on each launch (not
persisted).

## 5. Favorites — `⌃S`, `★`, `favorites.json`

- **`⌃S`** (search mode) toggles the favorite state of the highlighted entry (`current`).
  Flash `★ starred` / `☆ unstarred` in the footer's existing right slot.
  - `⌃S` is mnemonic for **S**tar. Raw mode disables terminal software flow-control
    (IXON), so `⌃S`/`⌃Q` reach the app — but this MUST be confirmed in a real terminal
    during implementation; if any common emulator swallows it, fall back to **`⌃B`**
    (bookmark) and update the footer hint.
  - **By design the toggle is instant and unconfirmed.** It is trivially reversible
    (`⌃S` again un-stars), so — unlike the destructive `⌃X` delete — it gets no undo
    window or confirm step (YAGNI). The flash is feedback, not a gate.
- **`★` marker:** favorited rows render a leading `★ ` in a **fixed 2-cell slot placed
  immediately after the 2-char gutter** (non-favorited rows render two spaces there), so
  the `{app}` column stays aligned regardless of favorite state. Row shape becomes:
  `{gutter:2}{starSlot:2}{app} · {action} {right}`.
- **Identity:** a favorite is keyed by **`app` + `action`** (the human-stable identity).
  Survives reordering, deleting *other* entries, and re-seeding. Editing an entry's
  `action` orphans its star (accepted — re-star it). Duplicate `app+action` rows toggle
  together (acceptable; duplicates are a data smell).

### 5.1 Store — `src/data/favorites.ts`

A new module owns `favorites.json` in the data dir (the loader only reads `*.yaml`, so
this file never appears as an entry).

**File format** (`<dataDir>/favorites.json`):
```json
{ "version": 1, "favorites": [ { "app": "Fork", "action": "Force push" } ] }
```

**API** (key = `` `${app}\u0000${action}` `` via exported `favKey(app, action)`):
- `loadFavorites(dir: string): Set<string>` — read + parse; return a Set of keys. On a
  missing or malformed file, return an **empty Set** (never throw).
- `saveFavorites(dir: string, keys: Set<string>): void` — serialize back to the
  `{version, favorites:[{app,action}]}` shape; write **atomically** (write
  `favorites.json.tmp`, then `renameSync` over the target).
- `toggleFavorite(dir: string, app: string, action: string): Set<string>` — load fresh,
  add/remove the key, save, return the new Set.

## 6. `esc` and clearing the filter

When a filter is active, `esc` **clears the filter first** (back to the full list), and a
second `esc` quits — giving a one-key path back to the clean state in addition to
`⌃F → All apps`. Order in the search-mode `useInput` (matches the existing structure —
the `esc` branch already sits after the `pendingDelete` interception):
`⌃C` hard-quit → `pendingDelete` interception → **filter-clear-or-quit on `esc`** → the
rest. Concretely:

```ts
if (key.escape) {
  if (filter.type !== "all") { setFilter({ type: "all" }); setSelected(0); return; }
  exit();
  return;
}
```

**Scope:** this is **search-mode only**. `esc` inside the add/edit form cancels that
modal (existing `onCancel`) and leaves the active filter untouched — the search `useInput`
is gated by `isActive: mode === "search"`, so the two `esc` behaviors never collide. `esc`
in the `FilterPicker` cancels the picker without changing the filter.

## 7. State & list pipeline (`App.tsx`)

New state: `mode` gains `"filter"`; `filter: Filter` (default `{ type: "all" }`);
`favorites: Set<string>` (loaded from `loadFavorites(dataDir)` on mount).

```ts
type Filter = { type: "all" } | { type: "app"; app: string } | { type: "favorites" };
```

Pipeline (replaces the single `search` memo; `search<T extends Entry>` preserves the
`LoadedEntry` element type, so `current`/`editTarget` stay `LoadedEntry`):
```ts
const scoped = useMemo(() => {
  if (filter.type === "app") return entries.filter((e) => e.app === filter.app);
  if (filter.type === "favorites") return entries.filter((e) => favorites.has(favKey(e.app, e.action)));
  return entries;
}, [entries, filter, favorites]);
const results = useMemo(() => search(scoped, query), [scoped, query]);
```

`⌃S` handler (import `{ favKey, toggleFavorite }` from `../data/favorites`; guarded by
`dataDir`, like add/edit/delete):
```ts
if (dataDir && current && key.ctrl && input === "s") {
  const next = toggleFavorite(dataDir, current.app, current.action);
  setFavorites(next);
  setFlash(next.has(favKey(current.app, current.action)) ? "★ starred" : "☆ unstarred");
  return;
}
```

`⌃F` handler: `setMode("filter")`. Selecting in the picker sets `filter`, resets
`selected` to 0, returns to `mode: "search"`.

## 8. Components & files

| File | Change |
|---|---|
| `src/data/favorites.ts` | **New.** `favKey`, `loadFavorites`, `saveFavorites`, `toggleFavorite` (atomic). |
| `src/tui/FilterPicker.tsx` | **New.** Overlay: pinned `★ Favorites`/`All apps` + sorted apps, type-to-filter, windowed, `⏎`/`esc`. Props: `apps`, `filter`, `onSelect(filter)`, `onCancel()`. |
| `src/tui/App.tsx` | Add `filter` + `favorites` state, `mode:"filter"`, scoped pipeline, `⌃F`/`⌃S` handlers, `esc`-clears-filter, render `FilterPicker` in filter mode, pass favorites + filter to children. |
| `src/tui/ResultRow.tsx` | Add `favorite: boolean` prop → render a **separate** 2-cell `Text` (`★ ` / `  `) right after the gutter, before `{app}`, so alignment holds across rows. |
| `src/tui/ResultList.tsx` | Pass per-row `favorite` (compute from the `favorites` set + `favKey`); render the favorites-view empty-state hint. |
| `src/tui/SearchInput.tsx` | Add optional `filterLabel?: string`; render the search text+cursor as the left group and the label right-aligned via `justifyContent="space-between"`. The block cursor stays immediately after the query (left group); the label is a separate right element and must `truncate` rather than displace the cursor — verify in a 100-col render. |
| `src/tui/Footer.tsx` | Add `⌃F filter` + `⌃S star`. Default hint: `↑↓ move ⏎ copy ⌃O add ⌃E edit ⌃X del ⌃F filter ⌃S star ⎋ quit ⌃U clear (N)` (~80 cells — fits 100). When a filter is active, swap `⎋ quit` → `⎋ clear filter`. `truncate-end` handles narrower terminals. |

`FilterPicker` windowing reuses the `visibleListHeight` idea from `layout.ts`.

## 9. Edge cases / error handling

- **Missing / malformed `favorites.json`** → treated as empty favorites; rewritten
  cleanly on the next toggle. Writes are atomic (temp + rename) to avoid corruption.
- **Orphaned favorite** (action edited / entry deleted) → its key matches no entry and
  simply doesn't render; not pruned (YAGNI).
- **Empty `★ Favorites`** → `ResultList`'s centered empty state shows
  `No favorites yet — ⌃S stars an entry.` within the 50-col left pane (the wording names
  the action so the path forward is clear even from inside the empty view).
- **No `dataDir`** (e.g. some tests) → `⌃S` is a no-op (no persistence), consistent with
  add/edit/delete being `dataDir`-guarded; filter still works (in-memory).
- **`⌃S` swallowed by a terminal** → fall back to `⌃B` (decided during the real-terminal
  check); single source of truth for the keybinding.

## 10. Keybindings (search mode, after this change)

`⌃C` quit · `esc` clear-filter-then-quit · `⌃O` add · `⌃E` edit · `⌃X` delete ·
`⌃F` filter · `⌃S` star · `↑↓`/`⌃N`/`⌃P` move · `⏎` copy · `⌃W`/`⌥⌫` word-delete ·
`⌃U` clear query · typing → query. (`⌃A` remains reserved for the future readline model.)

## 11. Testing

- **`tests/favorites.test.ts`** (new): `loadFavorites` on missing/malformed/valid files;
  `toggleFavorite` add→persist→reload sees it, then remove; atomic write leaves a valid
  file (no `.tmp` residue).
- **`tests/filter-picker.test.tsx`** (new, ink-testing-library): renders the pinned scope
  rows + apps; typing narrows the app rows while scope rows stay; highlight jumps to the
  first match; `⏎` selects (calls `onSelect` with the right `Filter`); `esc` cancels.
- **`tests/app.test.tsx`** (extend): `⌃S` adds a `★` to the current row + `★ starred`
  flash, and removes it on repeat; `⌃F` enters filter mode; selecting an app scopes the
  list + shows `(filter: …)`; selecting `★ Favorites` shows only starred rows; selecting
  `All apps` clears; `esc` clears an active filter (and quits when none); favorites
  persist across a simulated reload (new `App` over the same `dataDir`).

## 12. Acceptance criteria

- [ ] `⌃F` opens a picker with pinned `★ Favorites`/`All apps` + sorted apps; type-to-filter
      narrows apps; `⏎` scopes the list; `(filter: …)`/`(★ Favorites)` indicator shows.
- [ ] `⌃S` toggles a persisted star on the highlighted entry; `★` renders in the aligned
      2-cell slot; favorites survive restart via `favorites.json`.
- [ ] `★ Favorites` scope lists starred entries across apps; empty state shows the hint.
- [ ] `esc` clears an active filter first, then quits (search mode only); `⌃F → All apps`
      also clears; `esc` in a modal cancels the modal and preserves the filter.
- [ ] No schema/loader/writer changes; malformed `favorites.json` never crashes the TUI.
- [ ] `pnpm test`, `pnpm lint`, `pnpm typecheck` all green.

## 13. Release

Feature minor → **v0.6.0**. Release is user-driven (2FA): bump → tag → `npm publish` →
Homebrew formula bump (see [[keybook-homebrew-release]]) → GitHub Release.
