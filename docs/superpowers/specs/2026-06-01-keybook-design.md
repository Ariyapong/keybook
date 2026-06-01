# keybook — design spec

| | |
|---|---|
| **Status** | Draft, pending review |
| **Date** | 2026-06-01 |
| **Owner** | (you) |
| **Target** | v0.1 (personal, macOS) → v0.2 (AI authoring, learning, cross-platform) |
| **Repo** | `/Volumes/TonySpace/work/coding/side-project/keybook/` (own repo, open-source-ready) |

---

## 1. Executive summary

`keybook` is a self-contained, open-source **macOS terminal UI (TUI)** for searching the keyboard shortcuts and short "recipes" of your most-used apps.

**The problem:** you use many apps (Finder, Terminal, VS Code, Edge, Fork, tmux, the Claude app, …) and constantly forget their shortcuts — *"how do I open a new Finder tab beside this one?"*, *"how do I open Terminal at the current Finder folder?"*. The answer is scattered across docs, blog posts, and memory. There's no single, fast, searchable place you own.

**The solution:** one command, `keybook` (alias `kb`), launches an interactive TUI. You fuzzy-search by intent ("finder new tab", "terminal here"); the matching entry shows the key combo rendered as keycaps, or — for things that aren't a single keypress — a short recipe (steps and/or a shell command). Enter copies it to the clipboard. All data lives in **plain YAML files you own**, so the set grows by hand or via AI authoring (you tell an assistant "add the top VS Code shortcuts", review the git diff, commit).

**What makes this worth building:** it's a *single source of truth* you own and version, it's terminal-native (fits zsh + tmux), and it doubles as a passive learning tool — browsing exposes you to neighboring shortcuts until they stick.

**Scope discipline:** v0.1 ships the TUI + YAML data + validation + a seeded starter set, macOS-only, with the engine deliberately structured so AI authoring and learning features drop in later without rework.

---

## 2. Goals & non-goals

### Goals (v0.1)
- Find a forgotten shortcut or recipe in **seconds**, by intent, without leaving the terminal.
- Be a **single source of truth** you own: plain YAML files, versionable in git, editable in VS Code.
- Support **both** kinds of entry: a key combo *and* a short recipe (steps / shell command).
- Ship a curated **seed** so the tool is useful on first launch, not empty.
- Be **open-source-ready from day one**: own repo, MIT license, engine cleanly separated from data, no personal/company data in the public repo.
- Make **AI authoring** reliable via a schema + validation, so generated entries are always well-formed or rejected loudly.

### Non-goals (v0.1)
- AI `add` command that drafts entries via an LLM (deferred to v0.2 — engine is built ready for it).
- In-app add/edit form (you edit YAML files; AI assists).
- Active learning features — quiz, spaced repetition, "shortcut of the day" (deferred; v0.1 relies on *passive* learning through browsing).
- Cross-platform shortcuts (Linux/Windows). macOS only in v0.1.
- Homebrew tap, standalone single-file binary, GitHub Actions CI (fast-follows, not v0.1).
- Sync/cloud features (note: the data dir can simply *point at* a git- or cloud-synced folder; no built-in sync).

### Explicit non-purposes
- This is **not** a general note-taking app. Entries are shortcuts/recipes with a small, fixed shape — not free-form notes.
- This is **not** a macro runner or automation tool. It *shows* you a recipe/command; running it is your call (Enter copies, it doesn't execute).

---

## 3. Architecture overview

Two cleanly separated concerns — an **engine** (the open-source app) and **data** (yours, local):

```
┌─────────────────────────────────────────────────────────────┐
│  ENGINE  (open-source, the Ink app)                          │
│                                                              │
│   cli ──► config ──► data loader ──► search ──► TUI (Ink)    │
│            │            │                                     │
│            │            └─ zod schema validates every entry   │
│            └─ resolves data dir, first-run seed init          │
└─────────────────────────────────────────────────────────────┘
                    │ reads / initializes
                    ▼
┌─────────────────────────────────────────────────────────────┐
│  DATA  (yours, local — never in the public repo)             │
│                                                              │
│   $KEYBOOK_DATA_DIR  (default ~/.config/keybook/)            │
│     finder.yaml  terminal.yaml  vscode.yaml  …               │
│                                                              │
│   Seeded on first run from the engine's bundled seed/        │
│   Editable by hand (VS Code) or by AI (review git diff)      │
└─────────────────────────────────────────────────────────────┘
```

**Contract boundaries:**
- The **entry schema** (`src/data/schema.ts`) is the single source of truth for what an entry is. The loader, search, TUI, and any future AI-authoring command all depend on it and nothing else couples them.
- The **engine never contains personal data.** It ships only a public-safe `seed/`. Your real set lives in the data dir.
- **Validation happens at load time**, once, at the boundary. Search and TUI only ever see valid `Entry` objects.

---

## 4. Repo layout

Single package (not a monorepo — keybook is one app). ESM-only.

```
keybook/
├── .gitignore
├── .nvmrc                      # "22"
├── LICENSE                     # MIT
├── README.md                   # what / why / install / usage
├── biome.json
├── package.json                # "bin": { "keybook": ..., "kb": ... }
├── pnpm-lock.yaml
├── tsconfig.json
├── tsup.config.ts              # bundle src/cli.ts → dist/cli.js (ESM, shebang)
├── vitest.config.ts
├── seed/                       # bundled, public-safe starter data (shipped in npm package)
│   ├── finder.yaml
│   ├── terminal.yaml
│   ├── vscode.yaml
│   ├── edge.yaml
│   ├── fork.yaml
│   ├── tmux.yaml
│   ├── macos.yaml
│   └── claude.yaml
├── src/
│   ├── cli.ts                  # commander entry (the bin); default action launches the TUI
│   ├── config.ts               # data-dir resolution + first-run seed init
│   ├── clipboard.ts            # pbcopy wrapper (macOS)
│   ├── data/
│   │   ├── schema.ts           # zod schema + Entry / DataFile types + key-notation convention
│   │   ├── loader.ts           # read + parse + validate all *.yaml → Entry[]
│   │   └── types.ts
│   ├── search.ts               # search(entries, query) → RankedEntry[]   (pure)
│   └── tui/
│       ├── App.tsx             # state: query, results, selection; owns key handling
│       ├── SearchInput.tsx
│       ├── ResultList.tsx      # windowed list, highlights selection
│       ├── ResultRow.tsx       # "app · action … keys | recipe"
│       ├── PreviewPane.tsx     # keycaps OR steps/command + tags/notes
│       ├── Footer.tsx          # keybinding hints + "copied!" flash
│       └── keycaps.ts          # parse a keys string into tokens for rendering
├── tests/
│   ├── schema.test.ts
│   ├── loader.test.ts
│   ├── config.test.ts
│   ├── search.test.ts
│   ├── keycaps.test.ts
│   ├── clipboard.test.ts
│   └── tui.test.tsx            # ink-testing-library
└── docs/
    └── superpowers/specs/2026-06-01-keybook-design.md
```

---

## 5. Entry schema (the data model)

Defined in `src/data/schema.ts` as TypeScript types plus a **zod** validator. Validated once, at load.

### 5.1 Data file format

Each YAML file declares its **app once**, then lists entries (so the app isn't repeated on every row — easy for hand- and AI-editing):

```yaml
# ~/.config/keybook/finder.yaml
app: Finder
entries:
  - action: Open a new tab
    keys: "⌘T"
    tags: [new tab]

  - action: Open a new Finder window
    keys: "⌘N"

  - action: Open Terminal at the current folder
    steps:
      - Right-click the folder (or the folder name in the path bar)
      - Services → "New Terminal at Folder"
    notes: >-
      Enable once in System Settings → Keyboard → Keyboard Shortcuts →
      Services → Files and Folders.
    tags: [terminal here, open terminal, cd]
```

### 5.2 Normalized entry (what the engine works with)

```ts
interface Entry {
  app: string;        // inherited from the file: "Finder", "Terminal", "macOS", "Claude", …
  action: string;     // human description — the primary search target ("Open a new tab")
  keys?: string;      // a key combo, macOS glyph notation (see §5.3)   — shortcut form
  steps?: string[];   // ordered recipe steps                          — recipe form
  command?: string;   // optional shell one-liner for a recipe
  tags?: string[];    // synonyms / extra search terms ("terminal here", "cd")
  notes?: string;     // caveats, one-time setup, context
  source?: string;    // optional provenance / doc URL
}
```

**Invariant (enforced by zod `.refine()`):** every entry has **at least one of** `keys`, `steps`, or `command`. An entry that is none of a shortcut, a step list, or a command is meaningless and is rejected.

`app` is not present per-entry in the file — the loader injects it from the file-level `app`. (A file is "all the shortcuts for one app/context.")

### 5.3 Key-notation convention

To keep the seed and AI-authored entries consistent, `keys` uses macOS glyphs:

| Glyph | Means | Glyph | Means |
|---|---|---|---|
| `⌘` | Command | `⇧` | Shift |
| `⌥` | Option | `⏎` | Return/Enter |
| `⌃` | Control | `⎋` | Escape |
| `⇪` | Caps Lock | `⌫` | Delete |

Example: `"⌘⌥T"`. Chord sequences (rare) use a comma: `"⌃A, C"`. The renderer (`keycaps.ts`) tokenizes this for display; if it can't parse a string, it falls back to showing the raw string (so an odd entry never breaks the UI).

---

## 6. Config & data loading

### 6.1 Data-dir resolution (`src/config.ts`)

In order:
1. `$KEYBOOK_DATA_DIR` if set (lets you point at a private git- or cloud-synced folder across your two Macs).
2. `$XDG_CONFIG_HOME/keybook` if `XDG_CONFIG_HOME` is set.
3. `~/.config/keybook` (default).

### 6.2 First-run seed init

On launch, if the resolved data dir is missing or contains no `*.yaml`, copy the engine's bundled `seed/*.yaml` into it and print a one-line notice (`Initialized ~/.config/keybook from seed (8 files).`). Existing files are **never** overwritten on later runs — your edits are safe.

The bundled `seed/` is located at runtime relative to the built file via `new URL('../seed/', import.meta.url)`, and listed in `package.json` `files` so it ships in the npm package.

### 6.3 Loading (`src/data/loader.ts`)

- Read every top-level `*.yaml` in the data dir (non-recursive).
- Parse (the `yaml` package) and validate each file against the zod schema.
- Inject the file-level `app` into each entry → flat `Entry[]`.
- **Graceful validation:** a malformed entry or file does **not** crash the tool. The loader collects errors (`{ file, entryIndex, message }`), skips the offending entry, and loads everything else. Errors are printed to stderr before the TUI starts, and `keybook check` (§7) reports them in full.

---

## 7. CLI commands (v0.1)

commander-based. Running `keybook` with no subcommand launches the TUI.

| Command | Purpose |
|---|---|
| `keybook` (or `kb`) | Launch the interactive TUI (default action). |
| `keybook edit` | Open the data dir in `$EDITOR` (falls back to `code`, then `open`). |
| `keybook path` | Print the resolved data-dir path (and whether it came from env/XDG/default). |
| `keybook check` | Validate every YAML file; print problems with file + entry index; exit non-zero if any invalid. |
| `keybook --help` / `--version` | Standard. |

`check` exists specifically to support the AI-authoring loop: after an assistant edits the YAML, run `keybook check` to confirm the data is still valid before committing.

---

## 8. Search design (`src/search.ts`)

A **pure** function: `search(entries: Entry[], query: string) → RankedEntry[]`. No UI, fully unit-testable.

- Each entry is flattened to one searchable **haystack** string, most-important fields first:
  `` `${action}  ${tags.join(' ')}  ${app}  ${keys ?? ''}  ${notes ?? ''}` ``
- Matching uses the **`fzf` npm port** (in-process, fzf-quality scoring — no external `fzf` binary needed). Space-separated query tokens are **AND**-combined (fzf extended-search behavior), so `finder new tab` narrows correctly.
- Empty query → return all entries, sorted by `app` then `action` (stable browse order — good for passive learning).
- Non-empty query → rank by fzf score descending; tie-break by `app`, then `action`.

(`fuse.js` is a viable alternative if true per-field weighting is wanted later; the fzf port is chosen for familiar matching feel and speed. The pure-function boundary means swapping engines touches only this file.)

---

## 9. TUI design (Ink)

### 9.1 Layout

```
┌ keybook ─────────────────────────────────────────────┐
│ search: terminal here▏                                │
├──────────────────────────┬────────────────────────────┤
│ ▸ Finder   · Open Termin…│   Finder                    │
│   Terminal · New tab      │   Open Terminal at the      │
│   macOS    · Spotlight    │   current folder            │
│   …                       │                             │
│                           │   1. Right-click the folder │
│                           │   2. Services → New Termin… │
│                           │   $ open -a Terminal "$PWD" │
│                           │   tags: terminal here, cd   │
├──────────────────────────┴────────────────────────────┤
│ ↑↓ move   ⏎ copy   ⎋ quit            ✓ copied!          │
└────────────────────────────────────────────────────────┘
```

### 9.2 Components
- **`App`** — owns state (`query`, `entries`, `results`, `selectedIndex`, `flash`); wires keyboard input; recomputes `results` via `search()` on query change.
- **`SearchInput`** — controlled query line (`ink-text-input`).
- **`ResultList`** — renders a **windowed** slice of results sized to terminal height; highlights the selected row.
- **`ResultRow`** — `app · action … keys` (or a `recipe` badge when there's no `keys`).
- **`PreviewPane`** — the selected entry in full: a **shortcut** renders its keys as keycaps via `keycaps.ts`; a **recipe** renders numbered steps and the copyable `command`; plus `tags` and `notes`.
- **`Footer`** — keybinding hints and a transient `✓ copied!` flash.

### 9.3 Keybindings
| Key | Action |
|---|---|
| (type) | edit the search query |
| `↑` / `↓` (also `Ctrl-P` / `Ctrl-N`) | move selection |
| `⏎` | copy the selected entry's `keys`, else its `command`, else a text form, to the clipboard; flash `✓ copied!` |
| `⎋` / `Ctrl-C` | quit |

### 9.4 States
- **Empty query:** all entries, app-sorted (browse mode).
- **No matches:** centered `No matches for "<query>"`.
- **Load errors present:** a dim footer note `⚠ N entr(ies) skipped — run \`keybook check\``; valid entries still shown.

### 9.5 Keycap rendering (`keycaps.ts`)
Pure helper: split a `keys` string into tokens (`⌘`, `⌥`, `T`, …) for the preview to render as small boxed caps. Unparseable input → return a single token of the raw string (never throws). Unit-tested independently of Ink.

---

## 10. Seed content plan

Eight public-safe files, each ~10–20 of the *most useful* entries (a deliberately curated starter set, not exhaustive). Pruned/extended by you afterward.

| File | Covers | Includes a recipe? |
|---|---|---|
| `finder.yaml` | new tab/window, reveal, path bar, "Terminal at folder" | yes (Terminal-at-folder) |
| `terminal.yaml` | tabs/splits, clear, search, cursor nav | — |
| `vscode.yaml` | command palette, multi-cursor, terminal toggle, go-to | — |
| `edge.yaml` | tabs, address bar, find, devtools | — |
| `fork.yaml` | stage/commit, branch, diff navigation | — |
| `tmux.yaml` | prefix, panes/windows, copy-mode | yes (split + zoom combos) |
| `macos.yaml` | Spotlight, screenshots, window mgmt, switch apps | yes (screenshot-to-clipboard) |
| `claude.yaml` | Claude app: new chat, global summon hotkey, etc. | — |

**Accuracy rule:** real key combos are verified at authoring time (by hand or AI-assisted, reviewed via git diff) — *the spec commits to which apps, not to specific guessed keys.* Claude-app, Fork, and Edge shortcuts in particular get checked against their current versions.

---

## 11. Tech stack (final)

```
Runtime:      Node 22 LTS, ESM-only
Language:     TypeScript strict
Pkg mgr:      pnpm
Build:        tsup (bundle bin → dist/cli.js, ESM + shebang)
Lint/format:  Biome
Tests:        Vitest + ink-testing-library
TUI:          Ink (React for the terminal) + ink-text-input
CLI:          commander
Schema:       zod
YAML:         yaml
Fuzzy:        fzf (npm port) — in-process, fzf-quality matching
Clipboard:    pbcopy (macOS) via node:child_process
Pre-commit:   lefthook (lint + typecheck + test) — optional in v0.1
License:      MIT
Distribution: npm (npx keybook / npm i -g) → Homebrew tap / SEA binary (fast-follow)
```

Matches the conventions already used on bugrepro (Node 22, ESM, TS strict, pnpm, Biome, Vitest, tsup, commander), so the toolchain is familiar.

---

## 12. Testing strategy

TDD throughout (write the test, watch it fail, implement). Coverage surfaced, not gated.

| Module | Style | Tooling |
|---|---|---|
| `data/schema` | unit | Vitest — valid/invalid entries, the "at least one of keys/steps/command" refine |
| `data/loader` | unit | Vitest — temp dirs/fixtures; malformed file is skipped, others load; errors reported |
| `config` | unit | Vitest — env precedence (`KEYBOOK_DATA_DIR` > XDG > default), first-run seed init into a temp HOME |
| `search` | unit | Vitest — ranking, AND-token narrowing, empty-query browse order |
| `keycaps` | unit | Vitest — tokenization + raw-string fallback |
| `clipboard` | unit | Vitest — mock `child_process`; degrade when `pbcopy` absent |
| `tui` | component | Vitest + `ink-testing-library` — typing filters the list, selection drives preview, `⏎` triggers copy |

---

## 13. Distribution & open-source

- **Own git repo** at `/Volumes/TonySpace/work/coding/side-project/keybook/`, initialized on `main`.
- **MIT `LICENSE`** (most permissive, simplest for a dev tool) + **`README`** (what/why, install, usage, data-dir explanation, contributing).
- **Engine ↔ data separation** keeps the repo public-safe: only the general-purpose `seed/` is committed; personal/company entries live solely in your data dir. (Mirrors the IP care taken on bugrepro.)
- **Install paths:** `npx keybook` and `npm i -g keybook` in v0.1. Homebrew tap and a standalone single-file binary (Node 22 SEA or Bun `--compile`) are fast-follows.
- If the bare npm name `keybook` is taken at publish time, scope it (`@<you>/keybook`) — doesn't affect the command name.

---

## 14. v0.1 acceptance criteria

A v0.1 is done only when all of the following hold.

### Functional
- [ ] `keybook` (and `kb`) launches the TUI and lists the seeded entries.
- [ ] Typing fuzzy-filters results; multi-token queries (`finder new tab`) narrow by AND.
- [ ] Selecting an entry shows a preview: a shortcut renders as keycaps; a recipe renders numbered steps and/or its command.
- [ ] `⏎` copies the keys (or command) to the clipboard and flashes confirmation. *(Verified via `pbpaste` in a test or manually.)*
- [ ] `keybook path` prints the data dir; `keybook edit` opens it in `$EDITOR`.
- [ ] `keybook check` validates all data and exits non-zero on invalid entries, naming file + entry.

### Data / robustness
- [ ] First run initializes the data dir from `seed/`; subsequent runs never overwrite existing files.
- [ ] A malformed entry is skipped with a clear report; the rest of the data still loads (no crash).
- [ ] The schema rejects an entry that has none of `keys` / `steps` / `command`.

### Distribution / OSS
- [ ] Repo has an MIT `LICENSE` and a `README` covering install + usage + the data-dir model.
- [ ] `pnpm build` produces a runnable `dist/cli.js`; `npx`-style invocation works.
- [ ] No personal/company data is present in the committed repo (only the public `seed/`).

### Quality
- [ ] Biome clean, `tsc --strict` clean, Vitest green.

---

## 15. v0.2 and beyond (deferred)

Captured here so they aren't lost.

| Item | Notes |
|---|---|
| **AI `add` command** | `keybook add "open terminal at the current finder folder"` calls an LLM to draft a structured entry (keys/steps/command) for you to confirm, then appends to the right YAML file. The schema + `check` already make this safe. |
| In-app add/edit | A small Ink form to capture an entry without opening a file. |
| **Active learning** | "Shortcut of the day", a quiz mode, or light spaced-repetition over entries you look up most. |
| Usage stats / favorites | Track which entries you search for; pin or boost frequently-needed ones. |
| Cross-platform | Add a `platform` field + filter; Linux/Windows shortcuts; clipboard via a cross-platform lib. |
| Homebrew tap / SEA binary | Friction-free install for non-Node friends. |
| GitHub Actions CI | Lint + typecheck + test on push; release workflow. |
| Multi-machine sync note | Already supported informally: point `$KEYBOOK_DATA_DIR` at a git- or cloud-synced folder. |

---

## 16. Open questions & risks

| Item | Status | Mitigation |
|---|---|---|
| Bundled `seed/` path resolution under tsup/`dist` | Unverified | `new URL('../seed/', import.meta.url)` + `files` allowlist; covered by a loader/config test |
| npm name `keybook` availability | Unknown | Scope as `@<you>/keybook`; command name unaffected |
| Parsing arbitrary `keys` strings into keycaps | Low risk | `keycaps.ts` falls back to the raw string; never throws |
| Ink performance with a large data set | Low risk | List is windowed to terminal height; personal data set is small (hundreds, not thousands) |
| Clipboard on non-macOS | Out of scope v0.1 | macOS-only; detect `pbcopy`, degrade gracefully if absent |
| Accuracy of seeded shortcuts (esp. Claude app) | To verify | Verified at authoring time against current app versions; `check` guards structure, not correctness |

---

## 17. References

- Ink (React for the terminal): https://github.com/vadimdemedes/ink
- ink-text-input: https://github.com/vadimdemedes/ink-text-input
- fzf for JavaScript (npm port): https://github.com/ajitid/fzf-for-js
- zod: https://github.com/colinhacks/zod
- yaml: https://github.com/eemeli/yaml
- XDG Base Directory spec: https://specifications.freedesktop.org/basedir-spec/latest/

---

*End of spec. Implementation plan to follow in a separate document.*
