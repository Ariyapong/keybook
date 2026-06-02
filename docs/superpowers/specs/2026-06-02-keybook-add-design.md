# keybook `add` — design spec

| | |
|---|---|
| **Status** | Draft, pending review |
| **Date** | 2026-06-02 |
| **Target** | v0.3 — `keybook add` (manual interactive entry authoring) |
| **Reference** | [v0.1 design spec](2026-06-01-keybook-design.md) §15 · [v0.2 design spec](2026-06-02-keybook-v0.2-design.md) §8 |
| **Shipped baseline** | `@arthony/keybook@0.2.0` on npm; build on tsdown |

> Verified empirically against the installed `yaml@2.9.0`, `ink@5.2.1`, the real
> `seed/*.yaml`, `src/tui/App.tsx`, and `src/data/schema.ts` during an adversarial
> design review. Notable corrections from that review are called out inline.

---

## 1. Executive summary

`keybook add` lets a user create a new shortcut, command, or recipe entry through a
guided interactive form — no hand-editing YAML, no leaving the terminal. It is the
feature the project was architected for from day one: the v0.1 spec built the zod
schema and `keybook check` explicitly as the safety gate for an authoring command.

This is keybook's **first write path**. The data layer is read-only today; `add`
introduces a single, well-bounded YAML writer that validates against the existing
schema and preserves the user's comments.

**Scope (firm):**
1. A **manual** capture form (no LLM, no network, no new dependency) supporting all
   three entry types: key-combo **shortcuts**, terminal **commands**, and append-only
   multi-step **recipes** — plus tags and notes.
2. **Two entry points** sharing one form component: a standalone `keybook add`
   subcommand, and an in-TUI launch key (`⌃O`) from the search screen.
3. **Flag / non-interactive mode** for scripting (`keybook add --app … --keys …`).
4. Target app chosen from a **pick-list** of existing apps (+ "Create new app…").

**Out of scope (deferred — see §15):** AI/LLM drafting of entries from a phrase (the
original v0.1 framing — now a clean follow-up that reuses this form and the key
normalizer); editing/deleting existing entries; reordering recipe steps; favorites.

---

## 2. Goals & non-goals

### Goals
- A user can add a well-formed entry in under a minute without knowing the YAML
  schema or the macOS glyph notation (they can type `shift cmd p`; we normalize it).
- Every written entry is **schema-valid or rejected loudly** — `add` can never
  produce a file that fails `keybook check`.
- The user's existing **comments survive** an append (see §5.1 for the precise,
  honest preservation contract).
- Both the standalone command and the in-TUI launch use the **same** form component
  and the **same** write path — no divergence.
- Zero new runtime dependencies; works fully offline.

### Non-goals
- **AI drafting** (`keybook add "<phrase>"` → LLM). Deferred; the key normalizer and
  the review form built here are designed to be reused by it.
- **Editing or deleting** existing entries, and **reordering** recipe steps. `add`
  only appends.
- **Cursor-model text editing** inside form fields (mirrors the v0.1/v0.2 input
  model: append + word-back delete, no mid-string cursor).
- Any change to the search engine, the preview pane, or `keybook check`.

---

## 3. Decisions

Settled during brainstorming:

| Decision | Choice |
|---|---|
| Capture method | **Manual** form for v1; AI drafting deferred. |
| Entry types | **Full** — shortcut (`keys`), command (`command`), recipe (`steps`). |
| Entry points | **Both** — standalone `keybook add` **and** in-TUI launch key. |
| In-TUI launch key | **`⌃O`** ("open new"). Avoids the `⌃A` start-of-line binding that deferred Phase B readline may want. |
| Target app | **Pick-list** of existing apps + "Create new app…"; `--app` flag bypasses. |
| Confirm before write | **Always** — a review screen precedes every write. No auto-commit. |

---

## 4. Architecture & module boundaries

The entry schema (`src/data/schema.ts`) remains the single source of truth for what an
entry is. The new writer and the new command validate through `entrySchema` and nothing
else couples them — the same boundary the loader, search, and TUI already respect.

Components follow the codebase's existing compositional pattern (small, mostly stateless
pieces — `ResultList` ~38 lines, `PreviewPane` ~44 lines), not one monolith.

| File | New? | Responsibility |
|---|---|---|
| `src/data/writer.ts` | **new** | The only code that mutates YAML. `addEntry(dir, app, entry)` and `listApps(dir)`. Pure (filesystem in/out, no Ink, no commander). |
| `src/data/keys.ts` | **new** | Pure `normalizeKeys(input)` — word/ascii → macOS glyph string. Inverse vocabulary of `keycaps.ts`. |
| `src/data/types.ts` | edit | Export `EntryInput = Omit<Entry,'app'>` and `AddResult`. |
| `src/commands.ts` | edit | `runAdd(dir, draft)` returning `{ ok, lines }`, mirroring `runCheck`. The non-interactive engine; used by flag mode and tests. |
| `src/cli.ts` | edit | Register the `add` subcommand: options + interactive-vs-flag dispatch. |
| `src/tui/useAddForm.ts` | **new** | Hook owning form field state, validation, and form→`EntryInput` conversion. |
| `src/tui/AddEntryForm.tsx` | **new** | Thin orchestrator: wires `useAddForm` to the field/review views and a single `useInput`. |
| `src/tui/FormFields.tsx` | **new** | Stateless render of the fields given values + a focused index. |
| `src/tui/StepsBuilder.tsx` | **new** | Append-only steps micro-component. |
| `src/tui/ReviewScreen.tsx` | **new** | Stateless render of the drafted entry (reuses `KeyCaps`) + target path. |
| `src/tui/App.tsx` | edit | `mode: 'search' \| 'add'`; **modal** render (search **or** form); `dataDir` prop; entries in state with `reload()`; `⌃O` launch; footer hint. |

### 4.1 Types & signatures

```ts
// src/data/types.ts
export type EntryInput = Omit<Entry, "app">;          // what the form/writer handle
export interface AddResult {
  ok: boolean;
  file: string;        // absolute path written (or attempted)
  created: boolean;    // true if a new app file was created
  lines: string[];     // runCheck-style human-readable messages
}

// src/data/writer.ts
export function listApps(dir: string): string[];
export function addEntry(dir: string, app: string, entry: EntryInput): AddResult;
```

- **`listApps`** iterates every `*.ya?ml`, extracts the raw top-level `app` via
  `parseDocument` **before** schema validation, and **includes a file whose entries are
  malformed as long as `app` is readable** (so a user with one broken file can still
  target the right app). Result is trimmed, de-duped (case-insensitively, preserving the
  first-seen casing), and sorted.
- **`onSubmit`** prop on the form is typed `(app: string, entry: EntryInput) => AddResult`
  — no `as Entry` casting anywhere.
- **`AddResult.lines`** are `runCheck`-style: success `["✓ added to fork.yaml"]`,
  failure `["✗ keys, steps, or command required"]`. Standalone/flag modes print them;
  in-TUI flashes the first success line (~1.5s) before returning to search.

---

## 5. The write path (`writer.ts`)

`addEntry(dir, app, entry)` performs:

1. **Reject a stray `app` field early.** If `"app" in entry`, return
   `{ ok:false, lines:["Error: entry must not have an app field; use --app instead"] }`
   — a friendlier message than zod's `.strict()` "unrecognized key".
2. **Validate.** `entrySchema.safeParse(entry)`. On failure, return `{ ok:false, … }`
   with `issues.map(i => i.message)` — **never write an invalid entry.** (`entry` is a
   bare `EntryInput`; `app` lives only at the file's top level — the loader injects it
   after parsing, and both schemas are `.strict()`.)
3. **Resolve the target file.** Read `*.ya?ml` in `dir`; `parseDocument` each and match a
   top-level `app` where `fileApp.toLowerCase().trim() === app.toLowerCase().trim()`
   (so `fork`/`FORK`/` Fork ` all hit existing `Fork`). On no match, create a new file:
   - slug = `app.toLowerCase()` with non-alphanumeric runs → `-`; if `<slug>.yaml`
     already exists for an **unrelated** app, append a numeric suffix (`fork-2.yaml`) —
     never overwrite an unrelated file.
   - Build it with `new Document({ app: app.trim(), entries: [entry] })` and write
     `doc.toString()`. (**Do not** hand-write `app:\nentries:\n` then `addIn` — a bare
     `entries:` parses as a *null* scalar and `addIn(["entries"], …)` **throws**
     `Expected YAML collection`. Verified on `yaml@2.9.0`.) `created: true`.
4. **Append to an existing file via the Document AST** (not `stringify`):
   ```ts
   const original = readFileSync(path, "utf8");
   const doc = parseDocument(original);
   doc.addIn(["entries"], doc.createNode(entry));   // entries is a real seq here
   writeFileSync(path, doc.toString());
   ```
5. **Safety net.** Re-run `loadEntries(dir)`. If it now reports a *new* error for this
   file, **restore `original`** (`writeFileSync(path, original)`) and return
   `{ ok:false, … }`. Guarantees `add` never leaves a file that fails `keybook check`.
6. **File-I/O errors** (EACCES/ENOSPC on read or write) are caught and returned as
   `{ ok:false, file, created:false, lines:[err.message] }`. No restore needed when the
   write itself failed (original untouched). `addEntry` ensures the data dir exists
   (`config.ts`'s `ensureDataDir` only seeds an *empty* dir on first run and is a no-op
   afterward, so `addEntry` owns all new-file writes and the unwritable-dir path).
7. **No auto-commit.** The user owns the file; version control is theirs.

### 5.1 Preservation contract (corrected — read carefully)

A `parseDocument` → `toString()` round-trip **preserves**: comments (e.g. `nano.yaml`'s
`# --- GNU nano only`), `>-` block-scalar *markers*, and quoted keys (`keys: "⌘T"`).

It **does not preserve** byte-for-byte: per-file block-scalar **folding column** (a `>-`
note re-wraps at a different width) and inline **flow-array spacing**
(`tags: [new tab]` → `tags: [ new tab ]`). A bare round-trip already rewrites ~11/53
lines of `finder.yaml` and ~77/93 of `nano.yaml`; `toString({lineWidth:0})` makes it
*worse*, so it is not a fix. This churn is **cosmetic and semantically lossless** —
`loadEntries` parses the before/after identically.

**Therefore the acceptance test is semantic, not a byte diff** (see §11/§13): existing
entries must be byte-identical *as parsed by `loadEntries`*, and comment lines must
survive as substrings. We accept the cosmetic reformat as a known, documented trade-off
of using the safe Document API on a user-owned file.

### 5.2 Other gotchas (verified)

- **`createNode` omits `undefined` keys** (verified: an entry with
  `steps/tags/notes: undefined` writes only the present keys). Building the `EntryInput`
  with only populated keys is still the recommended pattern (guards against a caller
  passing explicit `null`, which *would* serialize and fail validation) — but it is
  belt-and-suspenders, not a crash fix.
- **At-least-one-of uses `Boolean()`** — an empty-string `keys`/`command` is falsy and
  fails the refine; the form enforces this before review (§7).
- **`noUncheckedIndexedAccess` is on** — array indexing in the writer needs null guards.
- **Concurrent edits** (documented, not solved): a file open in `$EDITOR` with unsaved
  changes can be clobbered by read-modify-write. We read immediately before writing;
  acceptable for a single-user local tool.

---

## 6. Key normalizer (`keys.ts`)

`normalizeKeys(input: string): string` converts human input into the canonical glyph
string the schema expects — the inverse of `keycaps.ts` parsing.

- **Chords** split on comma or the word `then`; each segment is **trimmed**
  (`"ctrl b , % "` → `"⌃B, %"`), matching `keycaps.ts`'s `.map(s => s.trim())`.
- **Vocabulary** (case-insensitive) within a segment: `cmd`/`command`/`⌘` → `⌘`;
  `opt`/`option`/`alt` → `⌥`; `ctrl`/`control` → `⌃`; `shift` → `⇧`; `return`/`enter` →
  `⏎`; `esc`/`escape` → `⎋`; `del`/`delete`/`backspace` → `⌫`; `tab` → `⇥`; `space` →
  `␣`; arrow words → `↑↓←→`. A trailing single letter/char is upper-cased (`p` → `P`).
- **Modifier order** canonicalized to `⌃⌥⇧⌘` then the key.
- **Repeated modifiers de-duped** (`"shift cmd cmd p"` → `"⇧⌘P"`).
- **Idempotent**: glyphs already present pass through, so `"⇧⌘P"` and `"shift cmd p"`
  produce the same result.
- **Unrecognized tokens preserved verbatim** (the schema + review screen are the
  backstop), matching the loader's "raw string on parse failure" philosophy.

---

## 7. The form (`AddEntryForm` + `useAddForm` + sub-views)

`useAddForm` owns field state, the `focused` index, validation, and `toEntryInput()`.
`AddEntryForm` is a thin orchestrator with a single `useInput`; `FormFields`,
`StepsBuilder`, and `ReviewScreen` are stateless views. The whole pick-list/selection
model is built on keybook's **own** `useInput` + `ResultList`-style selection — **no
third-party `Select` dependency** (none is installed; §12 holds at zero new deps).

```
keybook add

  App     ‹ Fork ▾ ›                 selection list: existing apps + "Create new app…"
  Type    ‹ (•) Shortcut  ( ) Command  ( ) Recipe ›
  Action  ‹ Push the current branch ›
  Keys    ‹ shift cmd p ›      →  ⇧⌘P     live glyph preview
  Tags    ‹ push, upload ›                suggestions from existing tags
  Notes   ‹ (optional) ›

  ⌃N next field · ⌃P prev field · ⏎ review · esc cancel
```

- **App** — a selection list seeded from `listApps(dir)` plus a "Create new app…" choice
  that reveals a name input; `↑/↓` move the selection, `⏎` chooses. Input is trimmed
  before matching.
- **Type toggle** is a **UI convenience only**, not a schema constraint: it selects which
  field is *shown/focused*. The form accepts any combination; the schema enforces
  at-least-one-of; the review screen renders **every populated field** (so an entry with
  both `keys` and `command`, which the seed data contains, is representable).
  - **Shortcut** → `Keys` input with a live `→ ⇧⌘P` preview (via `normalizeKeys`).
  - **Command** → a `$ command` input.
  - **Recipe** → a **`StepsBuilder`**: type a line + `⏎` appends it; `⌫` on an empty
    input removes the **last** step. **Append-only — no reorder in v0.3** (deferred,
    §15). No "selected step" index.
- **Tags** — comma-separated input; split on comma, **trim each**, silently drop
  empty/whitespace segments (`"push, upload ,  "` → `["push","upload"]`); if all drop
  out, omit `tags` entirely (valid).
- **Notes** — optional free text.
- **Navigation** — `⌃N` next field, `⌃P` previous (consistent with search's list
  navigation; `Tab` left unmapped). `↑/↓` operate within the app selection and the steps
  list only. `⏎` on the last field advances to review.
- **Validation gate (before review):** `app` and `action` non-empty, and
  `Boolean(keys || steps?.length || command)` — for keys specifically
  `Boolean(normalizeKeys(input).trim())`. Unmet → inline hint (e.g. "Keys required"),
  focus stays on the field; the user cannot reach review with whitespace-only keys.
- **Review screen (`ReviewScreen`)** — renders the drafted entry with the *existing*
  `parseKeys`/`KeyCaps` rendering plus the resolved target path. `⏎` writes (calls
  `onSubmit` exactly once), `e` returns to editing, `esc` cancels. Unrecognized key
  tokens render verbatim.

Input model matches the rest of keybook: append + backspace, no mid-string cursor.

---

## 8. Two entry points (shared component)

### 8.1 Standalone `keybook add`
`render(<AddEntryForm apps={listApps(dir)} existingTags={…} onSubmit={(app, e) => addEntry(dir, app, e)} onCancel={() => exit()} />)`.
On success, print the result's first line (`✓ added to fork.yaml`) and exit `0`; on
cancel, exit `0` silently.

### 8.2 In-TUI launch (`⌃O`) — modal render
`App.tsx` gains `mode: 'search' | 'add'` and a new `dataDir: string` prop, and **renders
modally**:

```tsx
if (mode === "add") {
  return <AddEntryForm apps={listApps(dataDir)} existingTags={…}
           onSubmit={submitAndReload} onCancel={() => setMode("search")} />;
}
return <Box flexDirection="column"> …existing search layout… </Box>;
```

- **Only one `useInput` is mounted at a time** — the search handler is *not rendered* in
  add mode, so there is no `isActive` juggling and no input cross-talk. The existing
  `key.escape → exit()` branch in the search handler needs **no change** (it simply isn't
  mounted while the form is open; the form owns `esc` = cancel).
- **Entries live in state.** Today `App` takes `entries` as a static prop memoized on
  `[entries, query]`. `App` now initializes entries state from the prop and exposes
  `reload()` = `loadEntries(dataDir)` → `setEntries(fresh)`. `submitAndReload` calls
  `addEntry`, and on `ok` runs `reload()`, `setMode("search")`, and flashes the success
  line. (`dataDir` as a prop keeps `App` testable: tests render
  `<App entries={…} dataDir={tmpDir} />`.)
- **Esc-cancel** sets `mode="search"`, immediately reverting the footer to search hints
  (no "cancelled" message) and preserving the prior query.
- The footer gains a `⌃O add` hint.

---

## 9. Flag / non-interactive mode

```bash
keybook add --app Fork --action 'Push the current branch' --keys '⇧⌘P' --tags push,upload
keybook add --app Terminal --action 'Open here' --command 'open .'
keybook add --app Finder --action 'New Terminal at folder' \
  --step 'Right-click the folder' --step 'Services → New Terminal at Folder'
```

- Options: `--app`, `--action`, `--keys`, `--command`, `--step` (repeatable), `--tags`
  (comma-separated, trimmed), `--notes`. `--keys` accepts glyphs **or** words —
  normalized identically.
- **Dispatch:** `--app` + `--action` + at least one of keys/command/step present →
  `runAdd` writes directly (validate + write + post-write check), prints `runCheck`-style
  lines, exits `0`/`1`. Required fields missing **and** stdout is a TTY → open the form
  pre-filled. Missing **and** non-TTY (CI) → error to stderr naming the missing field,
  **exit `2`** (usage error, distinct from `1` = validation/write failure).
- `runAdd(dir, draft)` builds the `EntryInput` (normalizing keys), calls `addEntry`, and
  maps `AddResult` → `{ ok, lines }`.

---

## 10. Error handling

| Situation | Behavior |
|---|---|
| Entry carries an `app` field | Friendly message ("use --app instead"); never validates/writes. |
| Schema validation fails | Form: inline messages, stay on form. Flag: stderr lines, exit `1`. Never writes. |
| Missing required field (flag, non-TTY) | stderr names the field; exit `2`. |
| `readFileSync`/`writeFileSync` throws | Catch; return `{ ok:false, lines:[err.message] }`; exit `1`. No restore (original untouched). |
| Post-write `loadEntries` reports a new error | Restore original file text; report failure; point to `keybook check`; exit `1`. |
| New-app slug collides with an unrelated file | Append numeric suffix (`fork-2.yaml`); never overwrite. |

---

## 11. Testing (TDD, existing conventions)

- **`tests/writer.test.ts`** —
  - append to an existing file: existing entries are **identical as parsed by
    `loadEntries`** (semantic equality, not byte diff) and a known comment line survives
    as a substring;
  - **create a brand-new app file end-to-end** (regression for the bare-`entries:`
    blocker) and confirm it loads;
  - strips/rejects a stray `app` field with the friendly message;
  - rejects an invalid entry without writing;
  - **slug collision**: seed `fork.yaml` whose `app:` is `ForkLift`, `addEntry(dir,'Fork',…)`
    creates `fork-2.yaml` with `app: Fork` and leaves `fork.yaml` byte-identical;
  - **restore-on-failure** path;
  - app-name match is case/whitespace-insensitive.
- **`tests/writer.test.ts` (listApps)** — a file whose entries are malformed still
  appears in the list as long as its top-level `app` is readable; results de-duped/sorted.
- **`tests/keys.test.ts`** — pure equivalence `normalizeKeys('shift cmd p') === '⇧⌘P'`
  and `=== normalizeKeys('⇧⌘P')`; modifier ordering; repeated-modifier de-dupe; chord
  trimming; unknown-token passthrough.
- **`tests/commands.test.ts`** — `runAdd` valid / invalid / missing-required, via
  `tmpDataDir`.
- **`tests/add-form.test.tsx`** (`ink-testing-library`, `stdin.write` + `await tick()`):
  field navigation via `⌃N`/`⌃P`; type toggle; steps add/remove (append-only); after
  typing `shift cmd p`, `lastFrame()` contains `⇧⌘P`; advancing to review does **not**
  call a `vi.fn()` `onSubmit` until the confirm key, then exactly once; `esc` cancels.
- **`tests/app.test.tsx`** — `⌃O` opens the form (search panes gone); a keystroke sent
  while `mode==='add'` does **not** change the search query; a successful submit reloads
  (render with a `tmpDataDir`, fill, confirm) and `lastFrame()` shows the new action;
  `esc` returns to search unchanged.
- **`tests/integration.test.ts`** — spawn the built `dist/cli.js` with `KEYBOOK_DATA_DIR`:
  a fully-specified flag add exits `0` and a subsequent `keybook check` exits `0`; a
  missing `--action` in the (non-TTY pipe) child exits `2` with the field named in
  stderr. (The "missing + TTY → open form" branch is covered by a pure unit test over
  `{flags, isTTY}`, since `execFileSync`'s child stdout is always a pipe.)

---

## 12. Tech-stack additions

| Area | Change |
|---|---|
| Runtime / language | None — Node 22, ESM, TS strict, tsdown, biome. |
| New deps | **None.** `yaml@2.9.0` (already installed) provides the Document API; zod and ink are already present; the form uses keybook's own input primitives. |
| New modules | `writer.ts`, `keys.ts`, `useAddForm.ts`, `AddEntryForm.tsx`, `FormFields.tsx`, `StepsBuilder.tsx`, `ReviewScreen.tsx`. |

---

## 13. Acceptance criteria

### Write path
- [ ] `addEntry` validates via `entrySchema` and never writes an invalid entry.
- [ ] Appending leaves existing entries **identical as parsed by `loadEntries`**, and
      comment lines survive (semantic preservation — not a byte diff; see §5.1).
- [ ] Creating a new app writes `<slug>.yaml` via `new Document(...)` (no bare-`entries:`
      crash); the entry omits the `app` field; slug collisions get a numeric suffix.
- [ ] After any write, `loadEntries` reports no new error; otherwise the original is
      restored.
- [ ] `listApps` includes apps from files whose entries fail validation.

### Form & entry points
- [ ] The form creates shortcut, command, and recipe entries; tags/notes optional; the
      Type toggle is UI-only and the review screen shows every populated field.
- [ ] App chosen from a pick-list (own input model, no new dep) with a working
      "Create new app…".
- [ ] `keybook add` (standalone) opens the form, writes on confirm, exits.
- [ ] `⌃O` opens the form modally; search input is inert while open; on submit the new
      entry appears in search; `esc` returns unchanged.
- [ ] A review/confirm step precedes every write (`onSubmit` fires once, after confirm).

### Flag mode
- [ ] A fully-specified `keybook add …` writes non-interactively, exits `0`; `keybook
      check` then exits `0`.
- [ ] `--keys 'shift cmd p'` and `--keys '⇧⌘P'` store the same value.
- [ ] Missing required field in a non-TTY context exits `2` with the field named.

### Quality
- [ ] All v0.2 tests still pass; new tests cover §11.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test` green in CI.
- [ ] No new runtime dependency added to `package.json`.

---

## 14. Risks & open questions

| Item | Risk | Mitigation |
|---|---|---|
| In-TUI integration touches `App.tsx` | Medium | **Modal** render (search *or* form) → one `useInput` mounted; `dataDir` prop keeps `App` testable; build the form standalone first |
| Cosmetic YAML reformat on append | Low (cosmetic) | Documented contract (§5.1); semantic, not byte, acceptance test |
| Free-text key entry error-prone | Low | Live glyph preview + review screen are the backstop |
| Steps `StepsBuilder` is the most novel sub-UI | Low (now append-only) | Reorder deferred; isolated add/remove tests |
| Concurrent `$EDITOR` edit clobbered | Low | Read-immediately-before-write; documented limitation |

---

## 15. Deferred (v0.4+)

| Item | Notes |
|---|---|
| **AI drafting** | `keybook add "<phrase>"` → `claude-haiku` via Structured Outputs over `entrySchema`, gated on `ANTHROPIC_API_KEY`, `@anthropic-ai/sdk` as an optional/lazy dep, silent fallback to this manual form. Reuses `normalizeKeys` and `ReviewScreen`. The original v0.1 vision; now an additive layer. |
| **Edit / delete** entries · **reorder** recipe steps | `add` only appends in v0.3. |
| **`--editor` handoff** | `keybook add -e` opens a templated stub in `$EDITOR` for bulk/multi-line adds. |
| Favorites · app filter | Independent of `add`; from the v0.2 §8 backlog. |

---

## 16. References

- v0.1 design spec §15 (AI `add` roadmap) and §3 (schema-as-boundary).
- v0.2 design spec §8 (in-TUI `add` form, deferred).
- `yaml` Document API: https://eemeli.org/yaml/#documents
- Ink `useInput`: https://github.com/vadimdemedes/ink#useinputinputhandler-options
- Prior art: pet (`pet new`), gh (`gh issue create`), lazygit custom-command prompts, navi.

---

*End of spec. Implementation plan to follow via the writing-plans skill.*
