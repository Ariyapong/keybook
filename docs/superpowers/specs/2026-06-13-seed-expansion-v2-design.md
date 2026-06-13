# keybook seed expansion v2 — design spec

| | |
|---|---|
| **Status** | Approved, pending spec review |
| **Date** | 2026-06-13 |
| **Target** | seed content only (no engine changes) |
| **Reference** | [v0.1 design spec](2026-06-01-keybook-design.md) §5 (schema), §10 (seed philosophy); [seed expansion v1](2026-06-02-seed-expansion-design.md) (the shipped precedent this reuses) |

---

## 1. Goal

Broaden the bundled seed beyond its current dev-tooling focus (Fork, git, VS Code,
Edge, Terminal, tmux, Vim, Nano, Finder, macOS, Claude, Text editing) into the apps
people use every day: a complete browser set, modern editors, and a notes app. Six
new app files plus an extension to the existing VS Code file. Content only — the
engine, schema, CLI, and TUI are unchanged.

## 2. Non-goals

- No schema/engine/TUI/CLI changes. Entries use the existing `Entry` shape (v0.1 spec §5.2).
- Not exhaustive references — curated **~12–16 entries per file**, matching the seed
  philosophy (v0.1 spec §10, seed-expansion v1 §2).
- No `platform` field, no app-icon/metadata work, no favorites/filter UI — those are
  separate backlog items.
- No Slack/comms in this pass (explicitly deselected during brainstorming).

## 3. Scope — files

| File | App name | Status | Verification |
|---|---|---|---|
| `seed/chrome.yaml` | `Google Chrome` | new | official docs **+ live menu cross-check** (installed) |
| `seed/safari.yaml` | `Safari` | new | official docs **+ live menu cross-check** (installed) |
| `seed/jetbrains.yaml` | `JetBrains` | new | official docs **+ live menu cross-check** via IntelliJ IDEA (installed; shared macOS keymap) |
| `seed/notion.yaml` | `Notion` | new | official docs (installed, but shortcuts are mostly in-app — partial menu cross-check only) |
| `seed/cursor.yaml` | `Cursor` | new | official docs only (not installed) |
| `seed/zed.yaml` | `Zed` | new | official docs only (not installed) |
| `seed/vscode.yaml` | `VS Code` | **extend** | official docs + dedup against current file |
| `tests/seed.test.ts` | — | modify | assert the six new apps are present |

Seed grows from **250** entries to **~340**.

## 4. Accuracy approach

These are current, real-world shortcuts that drift over time, so they are **not**
authored from memory and called verified. The bar is "grounded in an authoritative
source, cross-checked against the live app where possible."

**Authoring (per app):** a research subagent fetches the app's **official**
keyboard-shortcut documentation and returns each shortcut **quoted verbatim with its
source URL** — no paraphrasing a shortcut into existence. The YAML is then authored
from that grounded list.

**Live cross-check (where installed + menu-bar-exposed):** for Chrome, Safari, and
IntelliJ IDEA, dump the live application menus via macOS Accessibility (System Events)
and reconcile the authored `keys` against the real menu equivalents. Discrepancies are
resolved in favour of the live menu.

**Prerequisite & fallback:** the live menu dump requires Accessibility permission for
the controlling terminal/process. If that permission is not granted, the affected app
falls back to **docs-only** and the spec/commit message says so explicitly — we do not
guess to fill the gap.

**Tips that are not a single keypress** use the recipe form (`steps`/`notes`, and
`command` where relevant) — never a fabricated `keys`. Examples: Notion slash-commands,
JetBrains "Search Everywhere" (double-⇧), browser "jump to tab N".

**Notation:** macOS glyphs per v0.1 spec §5.3 (`⌘ ⌥ ⌃ ⇧ ⏎ ⎋ ⌫ ⇥ ␣ ↑ ↓ ← →`); chord
sequences use a comma (`"⌘K, ⌘S"`). Unparseable strings (e.g. `:%s/old/new/g`) render
as-is via the keycaps fallback (v0.1 spec §9.5) — fine for any literal key tokens.

## 5. Per-app coverage

Exact `keys` are finalized at authoring time from the official source; the lists below
define the *intended coverage* (~12–16 entries each).

### 5.1 `chrome.yaml` — Google Chrome
New tab / window / incognito window; reopen the last closed tab; next / previous tab;
jump to a specific tab (1–8) and the last tab; close the tab; focus the address bar;
find in page; reload / hard reload; history back / forward; open History / Downloads;
bookmark this page; zoom in / out / reset; open DevTools; toggle full screen.

### 5.2 `safari.yaml` — Safari
New tab / window / private window; reopen the last closed tab; next / previous tab;
focus the Smart Search field; find on page; reload; show / hide the sidebar; toggle
Reader; add a bookmark; history back / forward; zoom in / out / reset; pin the tab;
open the Web Inspector (requires the Develop menu — captured in `notes`); full screen.

### 5.3 `jetbrains.yaml` — JetBrains (IntelliJ macOS keymap)
Search Everywhere (double-⇧, recipe); Find Action; recent files; go to class / file /
symbol; find usages; rename (refactor); reformat code; run / debug; toggle line
comment; duplicate line; delete line; generate code; show intention actions / quick-fix
(⌥⏎); go to declaration; extend / shrink selection. `notes`: the macOS keymap is shared
across IntelliJ IDEA, WebStorm, PyCharm, etc.

### 5.4 `notion.yaml` — Notion
Quick Find / search; create a new page; toggle the sidebar; bold / italic / code /
strikethrough; create a to-do checkbox; indent / outdent a block; the slash menu for
blocks (recipe — `/` then a block type); turn a block into another type; navigate back;
toggle dark mode; duplicate a block. Several are in-app rather than menu-bar; those that
aren't single keypresses use `steps`/`notes`.

### 5.5 `cursor.yaml` — Cursor
Focused on Cursor's **AI-specific** bindings (the rest of the keymap is inherited from
VS Code): inline edit (⌘K); open chat (⌘L); composer / agent (⌘I); accept / reject an AI
suggestion; accept an inline completion (Tab); add selection to chat; new AI chat.
Plus one `notes` entry stating Cursor inherits the VS Code keymap → see the VS Code
entries for general editing/navigation. Keeps the file from duplicating VS Code.

### 5.6 `zed.yaml` — Zed
Command palette; file finder; project-wide search; multi-cursor (add cursor / select
next); split pane; toggle the integrated terminal; go to definition; rename symbol;
toggle the AI assistant panel; outline / go to symbol; format buffer; toggle the project
panel.

### 5.7 `vscode.yaml` — extend (dedup-aware)

The current file already contains: Command Palette `⌘⇧P`, Quick Open `⌘P`, toggle
terminal `` ⌃` ``, toggle sidebar `⌘B`, add cursor below `⌘⌥↓`, select next occurrence
`⌘D`, go to line `⌃G`, **Go to Definition `F12`**, **Rename `F2`**, Find/Replace
`⌘F, ⌥⌘F`, find in all files `⌘⇧F`, toggle line comment `⌘/`, move line `⌥↑/↓`, copy
line `⇧⌥↑/↓`, **Format document `⇧⌥F`**, split editor `⌘\`, **Quick Fix `⌘.`**, Zen
Mode `⌘K, Z`, delete line `⌘⇧K`, insert line below/above, select all occurrences
`⌘⇧L`, next problem `F8`, navigate back/forward, open Keyboard Shortcuts `⌘K, ⌘S`.

Add **~6–8 high-value entries that are NOT already present**, chosen from: Go to Symbol
in file (`⌘⇧O`) / in workspace (`⌘T`); Peek Definition (`⌥F12`); Find All References
(`⇧F12`); toggle the panel (`⌘J`); fold / unfold region (`⌘⌥[` / `⌘⌥]`); toggle word
wrap (`⌥Z`); trigger suggestion (`⌃␣`); reopen closed editor (`⇧⌘T`); indent / outdent
(`⌘]` / `⌘[`); show Source Control (`⌃⇧G`). Final selection verified against the file at
authoring time so nothing duplicates an existing `keys`/`action`.

## 6. Testing

- Extend `tests/seed.test.ts` to assert the six new apps (`Google Chrome`, `Safari`,
  `JetBrains`, `Notion`, `Cursor`, `Zed`) are present, alongside the existing set.
- Existing assertions (zero load errors, entry-count threshold) continue to cover the
  rest. The VS Code extension is covered by the zero-load-error assertion.
- `keybook check` on a freshly seeded dir must report all entries OK (`✓ ~340 entries OK`).
- One commit per app/task; `pnpm test seed` stays green after each.

## 7. Release

Content/feature minor → **v0.5.0**. Release is **user-driven** (2FA on the user's
machine): bump `package.json` → tag `v0.5.0` → `npm publish` → bump the Homebrew
formula (url + sha256) → GitHub Release. This spec/plan does not publish or tag.

## 8. Acceptance criteria

- [ ] Six new files exist with curated (~12–16 entry) content; `vscode.yaml` extended
      with ~6–8 non-duplicate entries.
- [ ] Every shortcut is grounded in an official source; Chrome/Safari/IntelliJ are
      additionally cross-checked against live menus (or docs-only is noted if
      Accessibility access is unavailable).
- [ ] Tips that aren't a single keypress use `steps`/`notes`, never a fabricated `keys`.
- [ ] `keybook check` → zero errors; seed test green incl. the six new apps.
- [ ] No engine/schema/TUI/CLI changes.
