# Seed Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the bundled seed with keyboard-navigation and tips/tricks shortcuts — a new system-wide macOS text-editing file, new Vim and Nano files, and more terminal/tmux/VS Code entries.

**Architecture:** Content-only change. Each file is `app:` + an `entries:` list following the existing `Entry` schema (`src/data/schema.ts`). No engine, schema, TUI, or CLI changes. Structure is guarded by the existing loader/schema via `keybook check` and `tests/seed.test.ts`.

**Tech Stack:** YAML data files in `seed/`, validated by zod via `src/data/loader.ts`; Vitest for the seed test.

**Reference spec:** `docs/superpowers/specs/2026-06-02-seed-expansion-design.md`

**Conventions:**
- macOS glyphs per v0.1 spec §5.3: `⌘ ⌥ ⌃ ⇧ ⏎ ⎋ ⌫ ⇥ ␣ ↑ ↓ ← →`. Chord sequences use a comma (`"⌃B, %"`).
- Tips that aren't a single keypress use `steps`/`notes` (and optionally `command`), never a fabricated `keys`.
- One commit per task. Run commands from the repo root.
- After each YAML task, `pnpm test seed` must stay green (zero load errors).

---

## File Structure

| File | Responsibility |
|---|---|
| `seed/text-editing.yaml` | **New.** System-wide macOS text-field navigation/editing (`app: Text editing`) |
| `seed/vim.yaml` | **New.** Curated Vim essentials & tips (`app: Vim`) |
| `seed/nano.yaml` | **New.** Curated GNU nano essentials (`app: Nano`) |
| `seed/terminal.yaml` | **Modify.** Append ~8 readline/shell entries |
| `seed/tmux.yaml` | **Modify.** Append ~6 pane/window entries |
| `seed/vscode.yaml` | **Modify.** Append ~6 editing/navigation entries |
| `tests/seed.test.ts` | **Modify.** Assert the three new apps are present |

---

## Task 1: New file — `seed/text-editing.yaml`

**Files:**
- Create: `seed/text-editing.yaml`
- Modify: `tests/seed.test.ts`

- [ ] **Step 1: Add the app to the seed test (and rename the case)** — `tests/seed.test.ts`

Replace the `it("covers all eight apps", ...)` block's title and app array. Change the title from `"covers all eight apps"` to `"covers every seeded app"`, and add `"Text editing"` to the list:

```ts
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
    ]) {
      expect(apps.has(a)).toBe(true);
    }
  });
```

- [ ] **Step 2: Run the seed test to verify it fails**

Run: `pnpm test seed`
Expected: FAIL — the "covers every seeded app" case fails because `apps.has("Text editing")` is false (file not created yet).

- [ ] **Step 3: Create `seed/text-editing.yaml`**

```yaml
app: Text editing
entries:
  - action: Move one word left / right
    keys: "⌥←, ⌥→"
    tags: [word, navigation, cursor]
  - action: Move to start / end of the line
    keys: "⌘←, ⌘→"
    tags: [line, home, end]
  - action: Move to start / end of the document
    keys: "⌘↑, ⌘↓"
    tags: [top, bottom, document]
  - action: Delete the previous word
    keys: "⌥⌫"
    tags: [delete, word, backspace]
  - action: Delete to the start of the line
    keys: "⌘⌫"
    tags: [delete, line]
  - action: Delete the next word (forward)
    keys: "fn⌥⌫"
    notes: ⌫ is Delete (Backspace); fn turns it into Forward Delete (⌦).
    tags: [delete, word, forward]
  - action: Select one word left / right
    keys: "⌥⇧←, ⌥⇧→"
    tags: [select, word]
  - action: Select to start / end of the line
    keys: "⌘⇧←, ⌘⇧→"
    tags: [select, line]
  - action: Select to start / end of the document
    keys: "⌘⇧↑, ⌘⇧↓"
    tags: [select, document]
  - action: Select all
    keys: "⌘A"
  - action: Undo / redo
    keys: "⌘Z, ⇧⌘Z"
  - action: Jump to start / end of line (emacs-style)
    keys: "⌃A, ⌃E"
    notes: Works in most macOS native (Cocoa) text fields, not every app.
    tags: [cursor, readline]
  - action: Delete to end of line (emacs-style)
    keys: "⌃K"
    notes: Cocoa text fields; pairs with ⌃Y to paste it back.
    tags: [delete, kill]
```

- [ ] **Step 4: Run the seed test to verify it passes**

Run: `pnpm test seed`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add seed/text-editing.yaml tests/seed.test.ts
git commit -m "feat(seed): system-wide macOS text-editing navigation shortcuts"
```

---

## Task 2: New file — `seed/vim.yaml`

**Files:**
- Create: `seed/vim.yaml`
- Modify: `tests/seed.test.ts`

- [ ] **Step 1: Add `"Vim"` to the seed test app list** — `tests/seed.test.ts`

In the same array from Task 1, add `"Vim"` after `"Text editing"`:

```ts
      "Text editing",
      "Vim",
```

- [ ] **Step 2: Run the seed test to verify it fails**

Run: `pnpm test seed`
Expected: FAIL — `apps.has("Vim")` is false (file not created yet).

- [ ] **Step 3: Create `seed/vim.yaml`**

```yaml
app: Vim
entries:
  - action: Enter Insert mode (before / after the cursor)
    keys: "i, a"
    tags: [insert, edit]
  - action: Return to Normal mode
    keys: "⎋"
    tags: [normal, escape]
  - action: Enter Visual / Visual-Block mode
    keys: "v, ⌃V"
    tags: [select, block]
  - action: Save the file
    keys: ":w⏎"
    tags: [write, save]
  - action: Save and quit
    keys: ":wq⏎"
    notes: ZZ does the same from Normal mode.
    tags: [save, quit, exit]
  - action: Quit without saving
    keys: ":q!⏎"
    tags: [quit, discard, exit]
  - action: Go to start / end of line
    keys: "0, $"
    notes: ^ jumps to the first non-blank character.
    tags: [line, motion]
  - action: Go to top / bottom of file
    keys: "gg, G"
    notes: ":42⏎" jumps to line 42.
    tags: [motion, goto]
  - action: Move word forward / back
    keys: "w, b"
    tags: [word, motion]
  - action: Jump to the matching bracket
    keys: "%"
    tags: [bracket, paren, match]
  - action: Delete / yank (copy) the current line
    keys: "dd, yy"
    tags: [delete, copy, cut]
  - action: Paste after / before the cursor
    keys: "p, P"
    tags: [paste]
  - action: Undo / redo
    keys: "u, ⌃R"
    tags: [undo, redo]
  - action: Repeat the last change
    keys: "."
    tags: [repeat, dot]
  - action: Search, then next / previous match
    keys: "/text⏎, n, N"
    tags: [search, find]
  - action: Replace every match in the file
    keys: ":%s/old/new/g⏎"
    notes: Add c at the end (…/gc) to confirm each replacement.
    tags: [replace, substitute, tip]
  - action: Change inside word / quotes / parens
    keys: 'ciw, ci", ci('
    notes: >-
      Text objects — "change inner". Swap c for d to delete instead (diw, di").
      Works with [], {}, <> too.
    tags: [text object, tip, change]
  - action: Indent / outdent the line or selection
    keys: ">>, <<"
    tags: [indent]
```

- [ ] **Step 4: Run the seed test to verify it passes**

Run: `pnpm test seed`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add seed/vim.yaml tests/seed.test.ts
git commit -m "feat(seed): curated Vim essentials and tips"
```

---

## Task 3: New file — `seed/nano.yaml`

**Files:**
- Create: `seed/nano.yaml`
- Modify: `tests/seed.test.ts`

- [ ] **Step 1: Add `"Nano"` to the seed test app list** — `tests/seed.test.ts`

In the same array, add `"Nano"` after `"Vim"`:

```ts
      "Vim",
      "Nano",
```

- [ ] **Step 2: Run the seed test to verify it fails**

Run: `pnpm test seed`
Expected: FAIL — `apps.has("Nano")` is false (file not created yet).

- [ ] **Step 3: Create `seed/nano.yaml`**

```yaml
app: Nano
entries:
  - action: Save the file (write out)
    keys: "⌃O"
    tags: [save, write]
  - action: Exit nano
    keys: "⌃X"
    tags: [quit, exit]
  - action: Show help
    keys: "⌃G"
    tags: [help]
  - action: Cut the current line
    keys: "⌃K"
    tags: [cut, delete]
  - action: Paste (uncut) the cut text
    keys: "⌃U"
    tags: [paste, uncut]
  - action: Set a mark, then move to select
    keys: "⌃6"
    notes: ⌃6 (or ⌃^) starts a selection; move the cursor to extend it, then ⌃K cuts it.
    tags: [select, mark]
  - action: Search
    keys: "⌃W"
    notes: After ⌃W, press ⏎ again to repeat the last search.
    tags: [find, search]
  - action: Search and replace
    keys: "⌃\\"
    tags: [replace]
  - action: Go to line / column
    keys: "⌃_"
    tags: [goto, line]
  - action: Go to top / bottom of the file
    keys: "⌥\\, ⌥/"
    tags: [top, bottom]
  - action: Page up / down
    keys: "⌃Y, ⌃V"
    tags: [scroll, page]
  - action: Undo / redo
    keys: "⌥U, ⌥E"
    tags: [undo, redo]
  - action: Show the current cursor position
    keys: "⌃C"
    tags: [position, line number]
  - action: Notation note (Control and Meta keys)
    steps:
      - nano writes ⌃ as "^" (Control) and ⌥ as "M-" (Meta)
      - "Example: ^O means Control-O; M-U means Meta-U"
    notes: >-
      On macOS, Meta = Option. If ⌥ shortcuts don't work in Terminal, enable
      Terminal → Settings → Profiles → Keyboard → "Use Option as Meta key".
    tags: [notation, meta, help]
```

- [ ] **Step 4: Run the seed test to verify it passes**

Run: `pnpm test seed`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add seed/nano.yaml tests/seed.test.ts
git commit -m "feat(seed): curated GNU nano essentials"
```

---

## Task 4: Extend `seed/terminal.yaml`

**Files:**
- Modify: `seed/terminal.yaml`

- [ ] **Step 1: Append the new entries** — at the end of the `entries:` list in `seed/terminal.yaml` (after the existing `Cancel the current command` entry), add:

```yaml
  - action: Delete to the start of the line
    keys: "⌃U"
    tags: [readline, kill]
  - action: Delete the character under the cursor (or EOF / logout)
    keys: "⌃D"
    notes: On an empty line, ⌃D signals end-of-input and can close the shell.
    tags: [readline, delete, eof]
  - action: Paste the last killed (deleted) text
    keys: "⌃Y"
    tags: [readline, yank, paste]
  - action: Delete the next word
    keys: "⌥D"
    tags: [readline, word]
  - action: Swap (transpose) the last two characters
    keys: "⌃T"
    tags: [readline, transpose]
  - action: Suspend the running program, then resume it
    keys: "⌃Z"
    command: fg
    notes: ⌃Z suspends to the background; type `fg` to resume (or `bg` to run it in the background).
    tags: [suspend, background, job]
  - action: Repeat the last command / reuse its last argument
    keys: "!!, !$"
    notes: >-
      !! re-runs the previous command (e.g. `sudo !!`); !$ expands to the last
      argument of the previous command.
    tags: [history, tip, bang]
  - action: Edit the current command line in your $EDITOR
    keys: "⌃X⌃E"
    notes: Opens the half-typed command in $EDITOR; save and quit to run it (bash/zsh).
    tags: [readline, editor, tip]
```

- [ ] **Step 2: Validate** — Run: `pnpm test seed`
Expected: PASS (3 tests; zero load errors confirms the new entries are well-formed).

- [ ] **Step 3: Commit**

```bash
git add seed/terminal.yaml
git commit -m "feat(seed): more terminal readline and shell tips"
```

---

## Task 5: Extend `seed/tmux.yaml`

**Files:**
- Modify: `seed/tmux.yaml`

- [ ] **Step 1: Append the new entries** — at the end of the `entries:` list in `seed/tmux.yaml` (after the existing `Reload the tmux config` entry), add:

```yaml
  - action: Break the current pane into its own window
    keys: "⌃B, !"
    tags: [pane, window, break]
  - action: Swap the current pane left / right
    keys: "⌃B, {"
    notes: "{ swaps with the previous pane; } swaps with the next."
    tags: [pane, swap, move]
  - action: Cycle through the preset pane layouts
    keys: "⌃B, ␣"
    tags: [layout, arrange]
  - action: Show pane numbers (then press one to jump)
    keys: "⌃B, Q"
    tags: [pane, jump]
  - action: Kill the current window
    keys: "⌃B, &"
    notes: Asks for confirmation.
    tags: [window, close, kill]
  - action: Paste the most recent copy-mode buffer
    keys: "⌃B, ]"
    tags: [paste, copy]
```

- [ ] **Step 2: Validate** — Run: `pnpm test seed`
Expected: PASS (3 tests).

- [ ] **Step 3: Commit**

```bash
git add seed/tmux.yaml
git commit -m "feat(seed): more tmux pane and window shortcuts"
```

---

## Task 6: Extend `seed/vscode.yaml`

**Files:**
- Modify: `seed/vscode.yaml`

- [ ] **Step 1: Append the new entries** — at the end of the `entries:` list in `seed/vscode.yaml` (after the existing `Toggle Zen Mode` entry), add:

```yaml
  - action: Delete the current line
    keys: "⌘⇧K"
    tags: [delete line]
  - action: Insert a line below / above
    keys: "⌘⏎, ⇧⌘⏎"
    tags: [new line]
  - action: Select all occurrences of the current selection
    keys: "⌘⇧L"
    tags: [multi cursor, select]
  - action: Go to the next problem (error / warning)
    keys: "F8"
    tags: [errors, diagnostics]
  - action: Navigate back / forward (cursor history)
    keys: "⌃-, ⌃⇧-"
    tags: [navigate, history, goto]
  - action: Open Keyboard Shortcuts
    keys: "⌘K, ⌘S"
    tags: [keybindings, shortcuts]
```

- [ ] **Step 2: Validate** — Run: `pnpm test seed`
Expected: PASS (3 tests).

- [ ] **Step 3: Commit**

```bash
git add seed/vscode.yaml
git commit -m "feat(seed): more VS Code editing and navigation shortcuts"
```

---

## Task 7: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `pnpm test`
Expected: all suites PASS (seed test green incl. Text editing / Vim / Nano).

- [ ] **Step 2: Build and validate the seed via the built CLI**

Run: `pnpm build && KEYBOOK_DATA_DIR="$(mktemp -d)" node dist/cli.js check`
Expected: `✓ N entries OK` (N ≈ 175), exit 0.

- [ ] **Step 3: Lint and typecheck**

Run: `pnpm lint && pnpm typecheck`
Expected: both clean. (If Biome reformats YAML/TS, run `pnpm format` and re-commit.)

- [ ] **Step 4: Commit any formatting fixes (if needed)**

```bash
git add -A
git commit -m "chore(seed): formatting after seed expansion"
```

(Skip if nothing changed.)

---

## Self-Review (completed by plan author)

**1. Spec coverage:**
- §4.1 text-editing.yaml → Task 1. §4.2 vim.yaml → Task 2. §4.3 nano.yaml → Task 3.
- §5 extensions → Tasks 4 (terminal), 5 (tmux), 6 (vscode).
- §6 testing (assert new apps; check) → Task 1 test edit (+ Tasks 2/3 add Vim/Nano), Task 7 build+check.
- §7 acceptance → verified across Tasks 1–7.

**2. Placeholder scan:** No TBD/TODO. Every YAML file's full content is inline; the test edits show exact code.

**3. Type/consistency:** All entries use only schema fields (`action`, `keys`, `steps`, `command`, `tags`, `notes`). App names match the seed-test array exactly: `Text editing`, `Vim`, `Nano`. Comma-chord notation in tmux matches the existing file's style (`⌃B, X`). Glyph notation matches v0.1 spec §5.3. No fabricated `keys` on tips — recipes use `steps`/`notes`/`command`.
