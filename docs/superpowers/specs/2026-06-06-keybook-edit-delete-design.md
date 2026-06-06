# keybook `edit` / `delete` — design spec

| | |
|---|---|
| **Status** | Draft, pending review |
| **Date** | 2026-06-06 |
| **Target** | v0.4 — in-TUI editing and deletion of existing entries |
| **Reference** | [`add` design spec](2026-06-02-keybook-add-design.md) (§15 deferred this) · v0.1 §3 (schema-as-boundary) |
| **Shipped baseline** | `@arthony/keybook@0.3.2` on npm; `add` write path live |

> The `yaml@2.9.0` Document API behaviours this design relies on were **verified
> empirically** (§12) against the repo's installed `yaml` — same discipline the `add`
> spec used. The TUI input flow and form-reuse were adversarially reviewed; the
> corrections are folded into §6–§9 inline.

---

## 1. Executive summary

`add` (v0.3) gave keybook its first write path: a guided form that *creates* entries.
But a typo or a changed shortcut today forces the user back into raw YAML in `$EDITOR` —
exactly the friction the form was built to remove. **`edit` and `delete` close the CRUD
loop** so the entire lifecycle of an entry lives inside the TUI.

Both act on the **currently-selected search result** — the entry you already found and
see in the `PreviewPane`. No separate "which entry?" step.

- **Edit** (`⌃E`) reopens the **existing `AddEntryForm`, pre-filled** with the entry's
  values, with the app/target file **locked** (editing in place). Same validation, same
  key-normalizer, same `ReviewScreen`. You edit exactly the way you add.
- **Delete** (`⌃X`) arms an **inline `y/n` confirm in the footer**; `y`/`⏎` removes the
  entry, any other key cancels. If it was the **last** entry in a file, the file is
  removed (an empty `entries:` array fails `keybook check` — §3).

**Scope (firm):** in-TUI only. No CLI flags, no scripted/non-interactive delete.
Targeting one entry among hundreds by flag is fiddly and error-prone; the TUI is where
you find the entry, so that is where you act on it.

**Out of scope (deferred):** recipe-step reorder; bulk operations; undo/trash;
edit/delete via the standalone `keybook add` command or any new subcommand.

---

## 2. Goals & non-goals

### Goals
- Fix or remove any entry without leaving the search TUI or touching YAML.
- **Reuse, don't rebuild:** edit drives the *same* `AddEntryForm`, `ReviewScreen`, and
  key normalizer; delete reuses the comment-preserving `Document` writer and the
  post-write `loadEntries` safety net that `addEntry` already established.
- **Every mutation is schema-valid or rejected loudly** — `edit`/`delete` can never leave
  a file that fails `keybook check` (the safety-net invariant extends to both).
- A loaded entry can be **traced back to its exact YAML location** (file + index),
  reliably, even when sibling entries are invalid.
- Zero new runtime dependencies.

### Non-goals
- **CLI / non-interactive** edit or delete (no `keybook delete --app …`).
- **Reordering** recipe steps, **bulk** edit/delete, **undo / trash / soft-delete**.
- **Cursor-model text editing** inside form fields (unchanged from v0.3: append +
  backspace, no mid-string cursor).
- Changing an entry's **app** during edit (that is a delete-here + add-there; out of
  scope — edit is in place).
- Any change to the search ranking, preview rendering, or `keybook check`.

---

## 3. Decisions

Settled during brainstorming (2026-06-06):

| Decision | Choice |
|---|---|
| Entry points | **In-TUI only.** No CLI flags, no scripted path. |
| Target entry | The **currently-selected** search result (highlighted + previewed). |
| Edit UX | **Reuse the pre-filled `AddEntryForm`**; app/file **locked**; edit in place. |
| Delete UX | **Inline `y/n` confirm in the footer**; `y`/`⏎` deletes, any other key cancels. |
| Last entry in a file | **Remove the file.** `fileShape` requires `entries.min(1)` (`schema.ts:25`), so an empty array is invalid — leaving it would fail `check`. |
| Triggers | **Control-keys** (`⌃E`, `⌃X`) — printable keys feed the search query (`App.tsx:89`). |

**`⌃E` / readline tension (acknowledged):** the deferred Phase-B readline backlog wants
`⌃E` = end-of-line in the *search input*. No cursor model exists today, so there is no
live conflict; `⌃E` = edit is the natural mnemonic and parallels the established
`⌃O` = add. If readline cursor editing is ever built, the reconciliation (scope `⌃E` to
when the query is empty, or remap) is noted in §14. `⌃X` ("cut") is unbound today.

---

## 4. Architecture & module boundaries

The change is small and rides entirely on existing seams. `entrySchema` stays the single
source of truth; the writer remains the only code that mutates YAML; the TUI calls the
writer directly (exactly as `App.tsx` already calls `addEntry`). **No new CLI commands,
no new top-level files** — every change is an edit to an existing file.

| File | Change | Responsibility |
|---|---|---|
| `src/data/types.ts` | edit | Add `LoadedEntry = Entry & { file: string; index: number }`. `Entry`, `EntryInput = Omit<Entry,'app'>`, `AddResult` unchanged (file/index live on `LoadedEntry`, never on `Entry`, so `EntryInput` is unaffected). |
| `src/data/loader.ts` | edit | `loadEntries` returns `LoadedEntry[]` — stamps each with source basename + **original YAML array index**. |
| `src/data/writer.ts` | edit | Add `editEntry(dir, file, index, entry, expectedAction)` and `deleteEntry(dir, file, index, expectedAction)`. Reuse `buildClean`, a shared drift guard, and the post-write safety net. |
| `src/search.ts` | edit | `search` becomes generic `<T extends Entry>(entries: T[], q): T[]` so it preserves `LoadedEntry` (it already returns the same object refs; pure type-level change). |
| `src/tui/useAddForm.ts` | edit | `useAddForm(initial?: Partial<Draft>)`; add pure `entryToDraft(app, entry): Draft` (inverse of `draftToEntryInput`). |
| `src/tui/AddEntryForm.tsx` | edit | Optional `initial?: Draft`, `lockedApp?: string`, `title?: string`. In edit mode: app field locked, focus starts at Type, `⌃P` floor = 1. |
| `src/tui/FormFields.tsx` | edit | New `lockedApp?: string` prop → render the app field as a dimmed, read-only display (no picker, no ↑/↓ affordance). |
| `src/tui/App.tsx` | edit | `mode: 'search' \| 'add' \| 'edit'`; `editTarget` + `pendingDelete` state; `⌃C`-first / `⌃E` / `⌃X` handlers; confirm interception. |
| `src/tui/Footer.tsx` | edit | Add a confirm prop; show the confirm question (left, truncatable) + a fixed `y / n` (right); add `⌃E`/`⌃X` hints (length-aware). |

### 4.1 Types & signatures

```ts
// src/data/types.ts
export interface LoadedEntry extends Entry {
  file: string;   // basename of the source file, e.g. "fork.yaml"
  index: number;  // ORIGINAL position in the file's `entries:` array (see §5)
}

// src/data/writer.ts
export function editEntry(
  dir: string, file: string, index: number,
  entry: EntryInput, expectedAction: string,
): AddResult;
export function deleteEntry(
  dir: string, file: string, index: number,
  expectedAction: string,
): AddResult;
```

`AddResult` is reused as the common write-result shape (`created` is always `false` for
edit/delete; `file` is the path acted on; `lines` are `runCheck`-style messages flashed
in the TUI). No new result type is warranted.

---

## 5. Entry provenance (the enabling change)

Today a `LoadResult.entries[i]` carries no link back to its YAML home (`loader.ts:61`
spreads `{ app, ...parsed.data }`), and **the loader skips invalid entries** (`return` on
parse failure, `loader.ts:53`). So a naive "in-memory array position" would **not** match
the YAML array position whenever an earlier entry in the same file is malformed.

**Fix — stamp each loaded entry with its file basename and its *original* YAML index:**

```ts
rawEntries.forEach((rawEntry, i) => {
  const parsed = entrySchema.safeParse(rawEntry);
  if (!parsed.success) { errors.push({ file, entryIndex: i, … }); return; }
  entries.push({ app, file, index: i, ...parsed.data });   // <- i, the YAML index
});
```

`file` is the basename already in scope; `index` is the loop counter `i` (the YAML array
index), **not** the `entries.push` position. This is the single correctness linchpin of
the feature, and §10 has a dedicated skew test for it.

`editEntry`/`deleteEntry` receive `(file, index)` and **re-parse the file fresh** at write
time, then operate on `["entries", index]`. Because the TUI **reloads after every
mutation**, the index a result carries is always consistent with the file on disk within a
session — and the **drift guard** (§6) is the backstop if it ever isn't.

`LoadedEntry extends Entry` is structurally compatible everywhere an `Entry` is read
(`search`, `ResultList`, `PreviewPane`), so the only ripple is making `search` generic.

---

## 6. The write path (`writer.ts`)

Both functions mirror `addEntry`'s structure: read original → `parseDocument` → mutate the
AST → write → **post-write `loadEntries` safety net** (restore original on a new error).
Two shared helpers:

- **Drift guard** — before mutating, confirm the node at `["entries", index]` still
  matches the entry we think we're touching, **trimmed on both sides**:
  ```ts
  import { isMap } from "yaml";
  const node = doc.getIn(["entries", index]);                       // a YAMLMap (verified §12-C3)
  const action = isMap(node) ? String(node.get("action") ?? "").trim() : undefined;
  if (action !== expectedAction.trim())
    return err(file, ["✗ entry changed on disk — reload and retry"]);
  ```
  Cheap protection against a stale index (e.g. the file was hand-edited between load and
  action). `App` passes the selected entry's `action` as `expectedAction`.
- **Safety net** — identical to `addEntry` (`writer.ts:140`): after writing, if
  `loadEntries(dir).errors` reports a *new* error for this file, restore `original` and
  return `{ ok:false }`. Guarantees `check` always passes.

### 6.1 `deleteEntry(dir, file, index, expectedAction)`
1. `path = join(dir, file)`; `original = readFileSync(path)` (catch → `err`).
2. `doc = parseDocument(original)`; **drift guard**.
3. `doc.deleteIn(["entries", index])` (verified §12-C1: removes exactly item `index`,
   siblings + their comments preserved).
4. **Empty-file rule (verified §12-C4):** detect emptiness via
   `(doc.getIn(["entries"]) as YAMLSeq).items.length === 0` — *not* a null/absent check
   (yaml@2.9.0 serializes an emptied seq as `[]`, never `null`, and a leftover seq-header
   comment would float above it). If empty, **`unlinkSync(path)`** (never write an empty
   `entries:` — it fails `fileShape`, §3). Otherwise `writeFileSync(path, doc.toString())`.
   **Order:** drift → `deleteIn` → unlink-or-write → safety net (after an unlink there is no
   file, hence no possible new error to restore — the net only matters on the write branch).
5. Return `{ ok:true, file, created:false, lines:["✗ deleted '<app>: <action>'"] }`
   (or `"…(removed empty <file>)"` when unlinked).

### 6.2 `editEntry(dir, file, index, entry, expectedAction)`
1. Reject a stray `app` field early (same friendly message as `addEntry`,
   `writer.ts:96`).
2. `entrySchema.safeParse(entry)` → on failure return the issue messages, **never write**.
3. `clean = buildClean(parsed.data)`.
4. `path = join(dir, file)`; `original = readFileSync` (catch → `err`).
5. `doc = parseDocument(original)`; **drift guard**.
6. `doc.setIn(["entries", index], doc.createNode(clean))` — **replaces the node in place**
   (verified §12-C2: seq length unchanged, siblings + their comments preserved).
7. `writeFileSync(path, doc.toString())`; **safety net**.
8. Return `{ ok:true, file, created:false, lines:["✓ updated '<app>: <action>'"] }`.

### 6.3 Preservation & gotchas (verified §12)
- The **cosmetic-reformat contract from the `add` spec §5.1 still applies** — a
  `parseDocument` → `toString()` round-trip is *semantically* lossless but may re-flow
  block scalars / flow-array spacing. **`setIn` additionally does not preserve a scalar's
  quoting style** (`keys: "A"` may re-serialize as `keys: A` when quotes aren't required —
  verified §12-C2). All of this is semantic-not-byte churn; the acceptance test is that
  `loadEntries` parses the file identically (§10), not a byte diff.
- **A leading comment binds to the seq, not to entry 0** (verified §12-C6): a comment on
  the line directly under `entries:` is the seq header, so deleting the first entry leaves
  it floating above the new first entry. Cosmetic and accepted; a comment that annotates a
  *specific* entry travels/deletes with it only when it sits on a **non-first** entry.
- `editEntry` does **not** move files or change the app; only the node at `index` changes.
- Concurrent `$EDITOR` edits: same documented single-user limitation as `addEntry` — we
  read immediately before writing; the drift guard catches the common case.

---

## 7. Edit flow — form reuse (`AddEntryForm`, `useAddForm`, `FormFields`)

Edit reuses the v0.3 form unchanged in spirit; the additions are backward-compatible.

- **`useAddForm(initial?: Partial<Draft>)`** — seeds state via `{ ...emptyDraft,
  ...initial }`. The existing call site `useAddForm(apps[0] ?? "")` becomes
  `useAddForm({ app: apps[0] })`.
- **`entryToDraft(app, entry): Draft`** (pure, in `useAddForm.ts`) — the inverse of
  `draftToEntryInput`:
  ```ts
  type = entry.keys ? "shortcut" : entry.command ? "command" : "recipe";
  { ...emptyDraft, app, type,
    action: entry.action,
    keys: entry.keys ?? "", command: entry.command ?? "",   // BOTH set independently
    steps: entry.steps ? [...entry.steps] : [],
    tags: (entry.tags ?? []).join(", "), notes: entry.notes ?? "" }
  ```
  Round-trips: `draftToEntryInput(entryToDraft(app, e))` deep-equals `buildClean(e)` (glyphs
  pass through `normalizeKeys` idempotently; `tags.join(", ")` re-splits via `parseTags`).
  An entry with **both** `keys` and `command` keeps **both** in the draft as separate
  fields; the type toggle picks `shortcut` for display, but both survive to review and to
  the written entry — the user toggles `←/→` on the Type field to edit the hidden one. §10
  has a both-keys-and-command round-trip test.
- **`AddEntryForm` props:** `initial?: Draft`, `lockedApp?: string`, `title?: string`.
  - When `lockedApp` is set (edit mode): the **app field is read-only** — `FormFields`
    takes a `lockedApp?` prop and renders the name **dimmed, with no picker, no ↑/↓
    affordance, no "Create new app…"**. `AddEntryForm` initializes `focused` to
    `lockedApp ? 1 : 0` (start on Type) and floors the `⌃P` handler at `lockedApp ? 1 : 0`,
    so navigation never lands on the locked field. `resolvedApp` returns `lockedApp`.
  - `title` defaults to `"keybook add"` (rendered at `AddEntryForm.tsx:172`); edit passes
    `"Edit entry — <app>"`.
  - `onSubmit(app, entry)` signature is **unchanged** — the form does not know whether it
    creates or updates. `App` supplies an `onSubmit` that calls `editEntry(...)` in edit
    mode. `ReviewScreen` is reused verbatim; its target-path line shows the existing file.

The single-`useInput` model, validation gate, and review confirm are all unchanged. The
form **unmounts** on cancel/complete (modal render, §8), so `focused`/`screen`/`hint`
state resets on the next open — §10 covers "open after cancel shows no stale state".

---

## 8. App wiring & footer (`App.tsx`, `Footer.tsx`)

`App` gains two pieces of state and a few input branches. Render stays **modal**
(search **or** form), so only one `useInput` is ever mounted.

```ts
const [mode, setMode] = useState<"search"|"add"|"edit">("search");
const [editTarget, setEditTarget] = useState<LoadedEntry|null>(null);
const [pendingDelete, setPendingDelete] = useState<LoadedEntry|null>(null);
```

**Input handler order (search mode) — order is load-bearing:**
1. **Hard-quit always wins:** `if (key.ctrl && input === "c") { exit(); return; }` at the
   very top, so `⌃C` quits even while a delete is armed.
2. **Delete-confirm interception** (only when `pendingDelete` is set) — placed *before* the
   `esc` branch so `esc` cancels the pending delete instead of quitting:
   ```ts
   if (pendingDelete) {
     if (key.return || input === "y" || input === "Y") {
       const r = deleteEntry(dataDir, pendingDelete.file, pendingDelete.index, pendingDelete.action.trim());
       if (r.ok) { reload(); setSelected(0); }
       setFlash(r.lines[0] ?? (r.ok ? "✗ deleted" : "✗ delete failed"));
     } else {
       setFlash("");                    // any other key (incl. esc) → silent cancel
     }
     setPendingDelete(null);            // we set flash explicitly here because the early
     return;                            // return below skips the top flash-clear line
   }
   ```
3. `⌃E` — **guarded on a selection:** `if (current && key.ctrl && input === "e") {
   setEditTarget(current); setMode("edit"); return; }`.
4. `⌃X` — **guarded on a selection:** `if (current && key.ctrl && input === "x") {
   setPendingDelete(current); return; }`. (`current` is `undefined` on empty results —
   without the guard a null target would be armed; §9.)
5. Existing branches (`esc` quit, `⌃O` add, nav, query editing) unchanged. The existing top
   line `if (!key.return && flash) setFlash("")` still runs for normal search keys; the
   delete-confirm block manages flash itself because it returns early.

**Modal render** — extend the existing `mode === "add"` block to also handle `"edit"`:
- `add`: as today.
- `edit` (with `editTarget`): render `AddEntryForm` with
  `initial={entryToDraft(editTarget.app, editTarget)}`, `lockedApp={editTarget.app}`,
  `title="Edit entry — …"`, and
  `onSubmit={(_, entry) => editEntry(dataDir, editTarget.file, editTarget.index, entry, editTarget.action)}`.
  `onComplete`: `reload()`, flash `✓ updated`, `setMode("search")`, clear `editTarget`.
  `onCancel`: `setMode("search")`, clear `editTarget`.

**Footer** — gains a confirm prop:
- When `pendingDelete` is set, `App` passes the question; the footer renders it in the
  **left** cell with `wrap="truncate-end"`, and renders a **fixed `y / n`** (yellow) in the
  **right** status cell — the same cell `flash` uses. This guarantees `y / n` stays
  **visible even when a long `app: action` truncates** (a single concatenated string can
  push `y / n` off-screen on an 80-col terminal). Question text: `Delete 'App: action'?`.
- The static hint adds editing keys while respecting the `truncate-end` frame-overflow
  guard (commit `66200d9`). Proposed string (drops the verbose `⌥⌫/⌃W del` word-delete
  hint from the *always-on* line — those keys still work — so "del" unambiguously means
  delete-entry):
  `↑↓ move  ⏎ copy  ⌃O add  ⌃E edit  ⌃X del  ⎋ quit  ⌃U clear (N)`
  Implementation confirms it fits at 80 columns (the list takes the left half) with
  `truncate-end` as the backstop (§10 / PTY smoke).

---

## 9. Error handling

| Situation | Behavior |
|---|---|
| `⌃E`/`⌃X` with no selected result (empty search, `current === undefined`) | No-op (guarded). |
| Index/content drift (node at `index` ≠ `expectedAction`, trimmed) | Abort, no write; flash `✗ entry changed on disk — reload and retry`. |
| Edit validation fails (e.g. all body fields cleared) | Form stays on the review/form screen with the issue message (existing `writeError` path); never writes. |
| `readFileSync`/`writeFileSync`/`unlinkSync` throws | Catch; return `{ ok:false, lines:[err.message] }`; flash it. |
| Post-write `loadEntries` reports a new error | Restore `original`; report failure (points to `keybook check`). |
| Delete removes the last entry in a file | `unlinkSync` the file; the app vanishes from `listApps`/search after reload. |
| Delete confirm armed; any non-`y`/`⏎` key (incl. `esc`) | Silent cancel; `setFlash("")`; footer reverts to hints. |
| Delete confirm armed; `⌃C` | App hard-quits (the `⌃C` branch runs before the confirm interception). |

---

## 10. Testing (TDD, existing conventions)

- **`tests/loader.test.ts`** — `LoadedEntry` carries `file` + correct `index`; the
  **skew test**: a file `[valid, INVALID, valid]` yields loaded entries with `index` `0`
  and `2` (not `0` and `1`).
- **`tests/writer.test.ts` (delete)** — deletes the correct node; **sibling entries +
  their comments survive** (semantic equality + comment substring); **unlinks the file**
  when the last entry is removed; **drift mismatch aborts** without writing; safety-net
  restore on an induced invalid result; file-not-found → `err`.
- **`tests/writer.test.ts` (edit)** — replaces the node **in place** (siblings + their
  comments preserved); validates and **rejects** an invalid edit without writing; drift
  guard; stray-`app`-field rejection; the edited entry loads back identically.
- **`tests/useAddForm.test.ts`** — `draftToEntryInput(entryToDraft(app, e))` deep-equals
  `buildClean(e)` for shortcut, command, recipe, and a **both-keys-and-command** entry;
  tags/notes round-trip.
- **`tests/app.test.tsx`** (`ink-testing-library`) — `⌃E` opens the form **pre-filled**
  (`lastFrame()` shows the entry's action/keys) with the app field locked; submitting a
  change reloads and the new value appears in search; `⌃X` shows the confirm prompt with a
  visible `y / n`, `y` removes the entry from results, a non-`y` key (and `esc`) cancels
  (entry still present, no quit); `⌃E`/`⌃X` are no-ops on empty results; reopening the form
  after a cancel shows no stale state.
- **`tests/integration` / PTY smoke** — edit an entry end-to-end against a `tmpDataDir`
  and confirm `keybook check` still exits `0`; delete the **last** entry in a file and
  confirm the file is gone and `check` exits `0`; confirm the footer hint + confirm prompt
  render on one line at 80 columns.
- All v0.3 tests (112) stay green.

---

## 11. Tech-stack additions

| Area | Change |
|---|---|
| Runtime / deps | **None.** `yaml@2.9.0` already provides `getIn`/`setIn`/`deleteIn`/`isMap`. |
| New modules | **None** — all changes are edits to existing files. |
| New CLI surface | **None** — in-TUI only. |

---

## 12. Empirical verification (verified against `yaml@2.9.0`)

Confirmed by throwaway ESM probe scripts run against the repo's installed `yaml` (scripts
deleted after; no tracked files touched). Results are folded into §6 above.

1. **`deleteIn(["entries", i])`** removes exactly item `i`, the seq reindexes, and
   **comments on sibling entries are preserved** (`# third entry comment` stayed on Gamma
   after Beta was deleted). *Confirmed.*
2. **`setIn(["entries", i], createNode(clean))`** **replaces in place** — seq length
   unchanged, neighbours and their comments intact. **Caveat:** does *not* preserve scalar
   quoting style (`keys: "A"` → `keys: A`); cosmetic, covered by §6.3. *Confirmed
   (nuanced).*
3. **`getIn(["entries", i])`** returns a `YAMLMap`; `isMap(node)` (from `yaml`) is `true`
   and `node.get("action")` returns the string — the drift guard reads fields without a
   full `toJS`. *Confirmed.*
4. **Emptied seq** serializes as `[]` (flow), **never `null`/absent**, and is reliably
   detected via `getIn(["entries"]).items.length === 0`. A seq-header comment would linger
   above `[]`, so the empty-file rule **unlinks** rather than writes (§6.1). *Confirmed
   (nuanced) — this drove the explicit `items.length` check.*
5. **`createNode`** of an `EntryInput` with `undefined` optional fields emits **only the
   present keys** (no `steps: null`). An explicit `null` *would* serialize, so the writer
   omits optional fields rather than nulling them — `buildClean` already does. *Confirmed.*
6. **A leading comment binds to the seq, not to entry 0** — deleting the first entry leaves
   the header comment floating above the new first entry; it is **not** misattached or
   dangling. Cosmetic, noted §6.3. *Confirmed (refuted the "dangling comment" worry).*

---

## 13. Acceptance criteria

### Provenance & write path
- [ ] `loadEntries` returns `LoadedEntry[]` with `file` + the **original** YAML `index`
      (skew test passes).
- [ ] `deleteEntry` removes the right node, preserves siblings/comments semantically,
      **unlinks the file when it empties** (detected via `items.length === 0`), and is
      guarded by drift + safety net.
- [ ] `editEntry` replaces in place, validates (never writes an invalid entry), preserves
      siblings/comments, and is guarded by drift + safety net.
- [ ] After any edit/delete, `loadEntries` reports no new error (or the original is
      restored); `keybook check` passes.

### TUI
- [ ] `⌃E` on the selected result opens the **pre-filled** form with the app **locked**;
      saving updates the entry in place and it reflects in search after reload.
- [ ] `⌃X` arms an inline footer confirm with a **visible `y / n`**; `y`/`⏎` deletes (flash
      `✗ deleted`), any other key cancels; `esc` while armed cancels without quitting;
      `⌃C` still hard-quits.
- [ ] Edit/delete are no-ops when no result is selected.
- [ ] The footer shows the new hints + confirm prompt without breaking the single-line
      frame at 80 columns.

### Reuse & quality
- [ ] `editEntry`/`deleteEntry` reuse `buildClean`, the drift guard, and the safety net;
      the edit form reuses `AddEntryForm`/`ReviewScreen`/`normalizeKeys` (no parallel UI).
- [ ] `draftToEntryInput(entryToDraft(app, e))` round-trips for all entry shapes, incl.
      both-keys-and-command.
- [ ] No new runtime dependency, no new CLI command, no new module.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test` green; all v0.3 tests still pass.

---

## 14. Risks & open questions

| Item | Risk | Mitigation |
|---|---|---|
| YAML index ↔ in-memory position skew | **High if wrong** | Stamp the *original* YAML `index` (§5); dedicated skew test; re-parse fresh per write; drift guard |
| `setIn` semantics (replace vs insert) | Resolved | Verified replace-in-place (§12-C2) |
| `⌃C` trapped during delete-confirm | Resolved | `⌃C` hard-quit branch runs *before* the confirm interception (§8) |
| Confirm prompt truncates the `y / n` | Resolved | Render `y / n` in the fixed right status cell; only the question truncates (§8) |
| `⌃E` vs future readline end-of-line | Low | No cursor model today; reconciliation noted (scope to empty query / remap) |
| Footer hint overflow | Low | `truncate-end` already guards; drop the word-delete hint from the always-on line; 80-col smoke test |
| Editing an entry with both keys+command | Low | Both preserved in the draft; type toggle reveals each; round-trip test covers it |
| Comment on the edited node lost; leading comment floats after delete | Low (accepted) | Documented §6.3; the user is rewriting that entry; sibling comments preserved |

---

## 15. Deferred (v0.5+)

| Item | Notes |
|---|---|
| **Recipe-step reorder** | Move steps up/down within an entry; pairs naturally with edit. |
| **Move entry to another app** | Edit currently locks the app; cross-file move = delete+add. |
| **Undo / trash** | A deleted entry is gone (re-add is fast); soft-delete if demand appears. |
| **CLI edit/delete** | Targeting by query/index non-interactively; out of scope now. |
| **AI drafting**, favorites, app filter | Independent backlog items (see `add` spec §15). |

---

## 16. References

- `add` design spec (`2026-06-02-keybook-add-design.md`) — §5 write path, §5.1
  preservation contract, §15 deferral of edit/delete.
- `yaml` Document API: https://eemeli.org/yaml/#modifying-nodes
- Ink `useInput`: https://github.com/vadimdemedes/ink#useinputinputhandler-options

---

*End of spec. Empirical checks (§12) done; implementation plan next via the writing-plans
skill.*
