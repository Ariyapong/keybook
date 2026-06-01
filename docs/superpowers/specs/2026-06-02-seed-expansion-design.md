# keybook seed expansion — design spec

| | |
|---|---|
| **Status** | Approved, pending spec review |
| **Date** | 2026-06-02 |
| **Target** | seed content only (no engine changes) |
| **Reference** | [v0.1 design spec](2026-06-01-keybook-design.md) §5 (schema), §10 (seed content plan) |

---

## 1. Goal

Expand the bundled seed with keyboard-navigation and "tips & tricks" shortcuts that
the v0.1 set lacks: system-wide macOS text editing (e.g. `⌥⌫` to delete a word),
more terminal/readline, tmux, and VS Code entries, and two new tools — **Vim** and
**Nano**. Content only; the engine, schema, and CLI are unchanged.

## 2. Non-goals

- No schema/engine/TUI changes. Entries use the existing `Entry` shape (v0.1 spec §5.2).
- Not exhaustive references — curated ~12–18 entries per file, matching the existing
  seed philosophy (v0.1 spec §10).
- No cross-platform `platform` field (still deferred to a later version). Vim/nano
  entries describe their standard bindings; macOS-specific caveats go in `notes`.

## 3. Accuracy approach

Unlike the Fork/Claude/Edge combos (which needed live-app menu verification), every
shortcut here comes from a **stable, well-documented standard**: GNU readline, Vim,
GNU nano, and the macOS Cocoa standard key bindings. These are authored directly and
guarded for **structure** by `keybook check` + the seed test. macOS-specific caveats
(e.g. nano's Meta key, forward-delete via `fn`) are captured in `notes`.

Tips/tricks that are not a single keypress use the **recipe form** (`steps` and/or
`notes`) rather than a `keys` combo — e.g. Vim search-and-replace, terminal
suspend/resume.

## 4. New files

### 4.1 `text-editing.yaml` — app: `Text editing`
System-wide macOS text-field navigation (works in browsers, native apps, most editors).

| action | keys |
|---|---|
| Move one word left / right | `⌥←`, `⌥→` |
| Move to start / end of line | `⌘←`, `⌘→` |
| Move to start / end of the document | `⌘↑`, `⌘↓` |
| Delete the previous word | `⌥⌫` |
| Delete to the start of the line | `⌘⌫` |
| Delete the next word | `fn⌥⌫` |
| Select one word left / right | `⌥⇧←`, `⌥⇧→` |
| Select to start / end of line | `⌘⇧←`, `⌘⇧→` |
| Select the whole line | (recipe: `⌘←` then `⌘⇧→`) |
| Select all | `⌘A` |
| Undo / Redo | `⌘Z`, `⇧⌘Z` |
| Jump to start / end of line (emacs-style) | `⌃A`, `⌃E` |
| Delete to end of line (emacs-style) | `⌃K` |

`notes` on the emacs-style row: these Cocoa bindings work in most native text views,
not in every app.

### 4.2 `vim.yaml` — app: `Vim`

| group | entries |
|---|---|
| Modes | `i` insert, `a` append, `Esc` normal, `v` visual, `⌃V` block visual |
| Save / quit | `:w`, `:wq` (or `ZZ`), `:q!` |
| Motion | `0` `$` `^`, `gg` `G`, `w` `b`, `%` matching bracket |
| Edit | `dd` delete line, `yy` yank, `p` paste, `x` delete char, `u` undo, `⌃R` redo, `.` repeat |
| Search / replace | `/pattern` + `n`/`N`; `:%s/old/new/g` (tip, with `notes`) |
| Text objects (tips) | `ciw` change inner word, `ci"` change inside quotes, `di(` delete inside parens |
| Indent | `>>`, `<<` |

Keys such as `ci"` and `:%s/old/new/g` are stored verbatim in `keys`; the keycaps
parser already falls back to rendering an unparseable string as-is (v0.1 spec §9.5).

### 4.3 `nano.yaml` — app: `Nano`
Notation: `⌃` = Control, `⌥` = Meta. A `notes` entry explains nano's `^`/`M-` notation
and that Meta may require "Use Option as Meta key" in Terminal.

| action | keys |
|---|---|
| Save (write out) | `⌃O` |
| Exit | `⌃X` |
| Cut / paste line | `⌃K`, `⌃U` |
| Search / replace | `⌃W`, `⌃\` |
| Set mark (start selection) | `⌃6` |
| Go to line / column | `⌃_` |
| Top / bottom of file | `⌥\`, `⌥/` |
| Page up / down | `⌃Y`, `⌃V` |
| Undo / redo | `⌥U`, `⌥E` |
| Show cursor position | `⌃C` |
| Help | `⌃G` |

## 5. Extend existing files (~6–8 entries each)

- **terminal.yaml**: `⌃U` delete to line start, `⌃D` delete char / EOF, `⌃Y` yank,
  `⌥D` delete word forward, `⌃T` transpose chars, `⌃Z` + `fg` suspend/resume (recipe),
  `!!` / `!$` history (tips), `⌃X ⌃E` edit command in `$EDITOR` (tip).
- **tmux.yaml**: `⌃B !` break pane to window, `⌃B {` / `⌃B }` swap pane,
  `⌃B Space` cycle layouts, `⌃B q` show pane numbers, `⌃B &` kill window,
  `⌃B ]` paste buffer.
- **vscode.yaml**: `⌘⇧K` delete line, `⌘⏎` / `⇧⌘⏎` line below/above,
  `⌘⇧L` select all occurrences, `F8` next problem, `⌃-` / `⌃⇧-` navigate back/forward,
  `⌘K ⌘S` keyboard shortcuts.

## 6. Testing

- Extend `tests/seed.test.ts` to assert the three new apps (`Text editing`, `Vim`,
  `Nano`) are present, alongside the existing eight.
- Existing assertions (zero load errors, entry-count threshold) continue to cover the
  rest. Total seed grows from ~110 to ~175 entries.
- `keybook check` on a freshly seeded dir must report all entries OK.

## 7. Acceptance criteria

- [ ] Three new files exist with the content above; three existing files extended.
- [ ] `keybook check` → zero errors; seed test green incl. the three new apps.
- [ ] Tips/tricks that aren't a single keypress use `steps`/`notes`, not a fake `keys`.
- [ ] No engine/schema/TUI changes.
