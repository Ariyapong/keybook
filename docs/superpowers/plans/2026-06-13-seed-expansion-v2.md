# Seed Expansion v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the bundled seed with six everyday-app files (Google Chrome, Safari, JetBrains, Notion, Cursor, Zed) and extend the VS Code file — broadening keybook beyond its dev-tooling core.

**Architecture:** Content-only change. Each new file is `app:` + an `entries:` list following the existing `Entry` schema (`src/data/schema.ts`). No engine, schema, TUI, or CLI changes. Structure is guarded by the existing loader/schema via `keybook check` and `tests/seed.test.ts`.

**Tech Stack:** YAML data files in `seed/`, validated by zod via `src/data/loader.ts`; Vitest for the seed test; macOS Accessibility (`osascript`/System Events) for the live menu cross-check.

**Reference spec:** `docs/superpowers/specs/2026-06-13-seed-expansion-v2-design.md`

---

## How to read this plan (accuracy contract)

Each app task contains a **concrete YAML draft** AND a **mandatory verification step**. The draft is a high-confidence starting point — it is NOT authoritative. Before committing each file you MUST:

1. **Fetch the official source** (URL given per task) and reconcile every `keys` value against it.
2. **For installed menu-bar apps (Chrome, Safari, JetBrains/IntelliJ): run the live menu dump** (procedure below) and reconcile against the real menu equivalents. Live menu wins over both the draft and the docs.
3. If a key in the draft can't be confirmed from the source, **correct it or drop the entry** — never commit an unverified key.
4. If Accessibility access is unavailable for the live dump, fall back to docs-only and say so in the commit message body.

Confidence guide: Chrome (Chromium → mirrors `edge.yaml`, high), Safari (high), VS Code additions (high) → expect the draft to survive mostly intact. JetBrains, Notion, Cursor, Zed → treat the draft as provisional; verification will likely correct several keys.

## Conventions

- macOS glyphs per v0.1 spec §5.3: `⌘ ⌥ ⌃ ⇧ ⏎ ⎋ ⌫ ⇥ ␣ ↑ ↓ ← →`. Chord sequences use a comma (`"⌘K, ⌘S"`). Alternate keys for one action also use a comma (`"⌘R, ⌘⇧R"` = reload / hard reload), mirroring `edge.yaml`.
- Tips that are not a single keypress use `steps`/`notes` (and optionally `command`), never a fabricated `keys` (e.g. JetBrains "Search Everywhere" = press ⇧ twice; Notion slash-menu).
- One commit per task. Run all commands from the repo root.
- After each YAML task, `pnpm test seed` must stay green (zero load errors).
- Commit messages: plain, no co-author/attribution trailer (project rule).

## Live menu dump procedure (Chrome / Safari / IntelliJ)

The target app must be **running**. Accessibility permission is required for the controlling terminal. Replace the process name as noted per task. Interpret `AXMenuItemCmdModifiers` as a bitfield added to an implied ⌘: `+1`=⇧, `+2`=⌥, `+4`=⌃, `+8`=removes ⌘ (so `0` means ⌘-only).

```bash
osascript <<'EOF'
tell application "System Events"
  if not (exists process "Google Chrome") then return "APP NOT RUNNING"
  tell process "Google Chrome"
    set out to ""
    repeat with mb in menu bar items of menu bar 1
      try
        repeat with mi in menu items of menu 1 of mb
          try
            set cc to value of attribute "AXMenuItemCmdChar" of mi
            if cc is not missing value and cc is not "" then
              set cm to value of attribute "AXMenuItemCmdModifiers" of mi
              set out to out & (name of mb) & " > " & (name of mi) & "  [mods=" & (cm as text) & " key=" & cc & "]" & linefeed
            end if
          end try
        end repeat
      end try
    end repeat
    return out
  end tell
end tell
EOF
```

If this errors with `not allowed assistive access`, grant the terminal Accessibility access (System Settings → Privacy & Security → Accessibility) or proceed docs-only and note it. To find the exact process name: `osascript -e 'tell application "System Events" to get name of every process whose background only is false'`.

---

## File Structure

| File | Responsibility |
|---|---|
| `seed/chrome.yaml` | **New.** Google Chrome shortcuts (`app: Google Chrome`) |
| `seed/safari.yaml` | **New.** Safari shortcuts (`app: Safari`) |
| `seed/jetbrains.yaml` | **New.** JetBrains macOS keymap essentials (`app: JetBrains`) |
| `seed/notion.yaml` | **New.** Notion essentials (`app: Notion`) |
| `seed/cursor.yaml` | **New.** Cursor AI-specific bindings (`app: Cursor`) |
| `seed/zed.yaml` | **New.** Zed essentials (`app: Zed`) |
| `seed/vscode.yaml` | **Modify.** Append ~6–8 non-duplicate entries |
| `tests/seed.test.ts` | **Modify.** Add the six new app names to the coverage array |

---

## Task 1: New file — `seed/chrome.yaml`

**Files:**
- Create: `seed/chrome.yaml`
- Modify: `tests/seed.test.ts`

- [ ] **Step 1: Add `"Google Chrome"` to the seed-test coverage array** — `tests/seed.test.ts`

In the `it("covers every seeded app", ...)` array, add `"Google Chrome",` after the `"Git",` line.

- [ ] **Step 2: Run the seed test to verify it fails**

Run: `pnpm test seed`
Expected: FAIL — `apps.has("Google Chrome")` is false (file not created yet).

- [ ] **Step 3: Verify keys against the official source**

Fetch Chrome's official shortcuts: `https://support.google.com/chrome/answer/157179` (macOS section). Chrome on macOS mirrors `seed/edge.yaml` (both Chromium); reconcile the draft below against the page.

- [ ] **Step 4: Live menu cross-check** (Chrome is installed)

Open Google Chrome, then run the live menu dump (process name `Google Chrome`). Reconcile every `keys` value below against the dump. Live menu wins.

- [ ] **Step 5: Create `seed/chrome.yaml`** (draft — apply corrections from Steps 3–4)

```yaml
app: Google Chrome
entries:
  - action: Open a new tab
    keys: "⌘T"
    tags: [new tab]
  - action: Reopen the last closed tab
    keys: "⌘⇧T"
    tags: [restore tab]
  - action: Open a new window
    keys: "⌘N"
  - action: Open a new Incognito window
    keys: "⌘⇧N"
    tags: [incognito, private]
  - action: Close the current tab
    keys: "⌘W"
  - action: Next / previous tab
    keys: "⌃⇥, ⌃⇧⇥"
  - action: Jump to tab 1–8
    keys: "⌘1"
    notes: ⌘1–⌘8 jump to that tab; ⌘9 jumps to the last tab.
  - action: Focus the address bar
    keys: "⌘L"
    tags: [omnibox, url]
  - action: Find on the page
    keys: "⌘F"
  - action: Reload / hard reload
    keys: "⌘R, ⌘⇧R"
  - action: Open Developer Tools
    keys: "⌘⌥I"
    tags: [devtools, inspect]
  - action: View page source
    keys: "⌘⌥U"
    tags: [source]
  - action: Open History
    keys: "⌘Y"
  - action: Open Downloads
    keys: "⌘⇧J"
    tags: [downloads]
  - action: Bookmark this page
    keys: "⌘D"
    tags: [favorite]
  - action: Zoom in / out / reset
    keys: "⌘+, ⌘-, ⌘0"
  - action: Back / forward
    keys: "⌘[, ⌘]"
  - action: Toggle full screen
    keys: "⌃⌘F"
    tags: [fullscreen]
```

- [ ] **Step 6: Run the seed test to verify it passes**

Run: `pnpm test seed`
Expected: PASS (3 tests).

- [ ] **Step 7: Commit**

```bash
git add seed/chrome.yaml tests/seed.test.ts
git commit -m "feat(seed): Google Chrome keyboard shortcuts"
```

---

## Task 2: New file — `seed/safari.yaml`

**Files:**
- Create: `seed/safari.yaml`
- Modify: `tests/seed.test.ts`

- [ ] **Step 1: Add `"Safari"` to the seed-test coverage array** — `tests/seed.test.ts`

Add `"Safari",` after the `"Google Chrome",` line.

- [ ] **Step 2: Run the seed test to verify it fails**

Run: `pnpm test seed`
Expected: FAIL — `apps.has("Safari")` is false.

- [ ] **Step 3: Verify keys against the official source**

Fetch Apple's Safari shortcuts: `https://support.apple.com/guide/safari/keyboard-and-other-shortcuts-cpsh003/mac`. Reconcile the draft below.

- [ ] **Step 4: Live menu cross-check** (Safari is installed)

Open Safari, run the live menu dump (process name `Safari`). Reconcile. Note: Web Inspector (`⌘⌥I`) only appears once the Develop menu is enabled — captured in `notes`, not assumed present in the menu dump.

- [ ] **Step 5: Create `seed/safari.yaml`** (draft — apply corrections from Steps 3–4)

```yaml
app: Safari
entries:
  - action: Open a new tab
    keys: "⌘T"
    tags: [new tab]
  - action: Open a new window
    keys: "⌘N"
  - action: Open a new private window
    keys: "⌘⇧N"
    tags: [private, incognito]
  - action: Reopen the last closed tab
    keys: "⌘⇧T"
    tags: [restore tab]
  - action: Close the current tab
    keys: "⌘W"
  - action: Next / previous tab
    keys: "⌃⇥, ⌃⇧⇥"
  - action: Jump to tab 1–8
    keys: "⌘1"
    notes: ⌘1–⌘8 select the first eight tabs; ⌘9 selects the last tab.
  - action: Focus the Smart Search field (address bar)
    keys: "⌘L"
    tags: [url, search]
  - action: Find on the page
    keys: "⌘F"
  - action: Reload the page
    keys: "⌘R"
  - action: Show / hide the sidebar
    keys: "⌘⇧L"
    tags: [sidebar, bookmarks]
  - action: Show Reader
    keys: "⌘⇧R"
    tags: [reader]
  - action: Add a bookmark for this page
    keys: "⌘D"
    tags: [favorite]
  - action: Back / forward
    keys: "⌘[, ⌘]"
  - action: Zoom in / out / reset
    keys: "⌘+, ⌘-, ⌘0"
  - action: Show the tab overview
    keys: "⌘⇧\\"
    tags: [tabs, overview]
  - action: Open the Web Inspector
    keys: "⌘⌥I"
    notes: Requires the Develop menu — enable it in Settings → Advanced → "Show features for web developers".
    tags: [devtools, inspect]
  - action: Toggle full screen
    keys: "⌃⌘F"
    tags: [fullscreen]
```

- [ ] **Step 6: Run the seed test to verify it passes**

Run: `pnpm test seed`
Expected: PASS (3 tests).

- [ ] **Step 7: Commit**

```bash
git add seed/safari.yaml tests/seed.test.ts
git commit -m "feat(seed): Safari keyboard shortcuts"
```

---

## Task 3: New file — `seed/jetbrains.yaml`

**Files:**
- Create: `seed/jetbrains.yaml`
- Modify: `tests/seed.test.ts`

- [ ] **Step 1: Add `"JetBrains"` to the seed-test coverage array** — `tests/seed.test.ts`

Add `"JetBrains",` after the `"Safari",` line.

- [ ] **Step 2: Run the seed test to verify it fails**

Run: `pnpm test seed`
Expected: FAIL — `apps.has("JetBrains")` is false.

- [ ] **Step 3: Verify keys against the official source**

Fetch the JetBrains macOS keymap reference: `https://www.jetbrains.com/help/idea/reference-keymap-mac-default.html` (and `.../mastering-keyboard-shortcuts.html`). Reconcile the draft — these are the default **macOS** keymap bindings, shared across IntelliJ IDEA / WebStorm / PyCharm.

- [ ] **Step 4: Live menu cross-check** (IntelliJ IDEA is installed)

Open IntelliJ IDEA, run the live menu dump (process name from the `get name of every process` command — typically `idea`). Reconcile menu-exposed actions. Note: "Search Everywhere" (double-⇧) and "Show Intention Actions" are not simple menu accelerators; keep them as `notes`/`steps` rather than a fabricated `keys`.

- [ ] **Step 5: Create `seed/jetbrains.yaml`** (draft — apply corrections from Steps 3–4)

```yaml
app: JetBrains
entries:
  - action: Search Everywhere
    steps:
      - Press ⇧ twice (double-Shift)
      - Type a class, file, action, or setting name
    notes: The universal search across the IDE. macOS keymap, shared by IntelliJ IDEA, WebStorm, PyCharm, etc.
    tags: [search, navigate]
  - action: Find Action
    keys: "⌘⇧A"
    tags: [action, command]
  - action: Recent files
    keys: "⌘E"
    tags: [navigate, recent]
  - action: Go to class
    keys: "⌘O"
    tags: [navigate, goto]
  - action: Go to file
    keys: "⌘⇧O"
    tags: [navigate, goto]
  - action: Go to symbol
    keys: "⌥⌘O"
    tags: [navigate, goto]
  - action: Go to declaration / definition
    keys: "⌘B"
    tags: [navigate]
  - action: Find usages
    keys: "⌥F7"
    tags: [search, references]
  - action: Rename (refactor)
    keys: "⇧F6"
    tags: [refactor]
  - action: Reformat code
    keys: "⌥⌘L"
    tags: [format]
  - action: Show intention actions / quick-fix
    keys: "⌥⏎"
    tags: [quickfix, lightbulb]
  - action: Run
    keys: "⌃R"
    tags: [run]
  - action: Debug
    keys: "⌃D"
    tags: [debug]
  - action: Toggle line comment
    keys: "⌘/"
    tags: [comment]
  - action: Duplicate the current line / selection
    keys: "⌘D"
    tags: [edit]
  - action: Delete the current line
    keys: "⌘⌫"
    tags: [delete line]
  - action: Generate code
    keys: "⌘N"
    notes: Constructors, getters/setters, overrides, etc.
    tags: [generate]
  - action: Extend / shrink selection
    keys: "⌥↑, ⌥↓"
    tags: [select]
  - action: Code completion
    keys: "⌃␣"
    tags: [autocomplete]
```

- [ ] **Step 6: Run the seed test to verify it passes**

Run: `pnpm test seed`
Expected: PASS (3 tests).

- [ ] **Step 7: Commit**

```bash
git add seed/jetbrains.yaml tests/seed.test.ts
git commit -m "feat(seed): JetBrains (macOS keymap) essentials"
```

---

## Task 4: New file — `seed/notion.yaml`

**Files:**
- Create: `seed/notion.yaml`
- Modify: `tests/seed.test.ts`

- [ ] **Step 1: Add `"Notion"` to the seed-test coverage array** — `tests/seed.test.ts`

Add `"Notion",` after the `"JetBrains",` line.

- [ ] **Step 2: Run the seed test to verify it fails**

Run: `pnpm test seed`
Expected: FAIL — `apps.has("Notion")` is false.

- [ ] **Step 3: Verify keys against the official source**

Fetch Notion's shortcuts: `https://www.notion.so/help/keyboard-shortcuts`. Notion shortcuts are largely **in-app** (not menu-bar), so this doc is the primary source. Reconcile every key in the draft — Notion's block/formatting shortcuts are easy to misremember, so verify each.

- [ ] **Step 4: Partial live cross-check** (Notion is installed)

Notion's macOS menu bar is sparse; only confirm the few menu-exposed items (search, new page, sidebar) via the live dump (process name `Notion`). The rest rely on Step 3.

- [ ] **Step 5: Create `seed/notion.yaml`** (draft — apply corrections from Steps 3–4)

```yaml
app: Notion
entries:
  - action: Quick Find (search)
    keys: "⌘P"
    notes: ⌘P opens Quick Find; ⌘⇧P (or ⌘K) opens Search depending on version — verify against the help page.
    tags: [search, find]
  - action: Create a new page
    keys: "⌘N"
    tags: [new page]
  - action: Toggle the sidebar
    keys: "⌘\\"
    tags: [sidebar]
  - action: Bold / italic / underline
    keys: "⌘B, ⌘I, ⌘U"
    tags: [format]
  - action: Inline code
    keys: "⌘E"
    tags: [format, code]
  - action: Strikethrough
    keys: "⌘⇧S"
    tags: [format]
  - action: Create a link
    keys: "⌘K"
    tags: [link]
  - action: Insert a block (slash menu)
    steps:
      - Type / at the start of a line
      - Pick a block type (heading, to-do, toggle, code, …)
    notes: The slash menu is the main way to insert and transform blocks.
    tags: [block, insert, tip]
  - action: Indent / outdent a block
    keys: "⇥, ⇧⇥"
    tags: [indent, nest]
  - action: Duplicate the selected block
    keys: "⌘D"
    tags: [block, duplicate]
  - action: Navigate back / forward
    keys: "⌘[, ⌘]"
    tags: [navigate, history]
  - action: Add a comment
    keys: "⌘⇧M"
    tags: [comment]
  - action: Toggle dark mode
    keys: "⌘⇧L"
    tags: [theme, dark mode]
```

- [ ] **Step 6: Run the seed test to verify it passes**

Run: `pnpm test seed`
Expected: PASS (3 tests).

- [ ] **Step 7: Commit**

```bash
git add seed/notion.yaml tests/seed.test.ts
git commit -m "feat(seed): Notion essentials"
```

---

## Task 5: New file — `seed/cursor.yaml`

**Files:**
- Create: `seed/cursor.yaml`
- Modify: `tests/seed.test.ts`

- [ ] **Step 1: Add `"Cursor"` to the seed-test coverage array** — `tests/seed.test.ts`

Add `"Cursor",` after the `"Notion",` line.

- [ ] **Step 2: Run the seed test to verify it fails**

Run: `pnpm test seed`
Expected: FAIL — `apps.has("Cursor")` is false.

- [ ] **Step 3: Verify keys against the official source** (Cursor is NOT installed → docs only)

Fetch Cursor's keyboard-shortcut docs: `https://docs.cursor.com/kbd` (and the Cursor docs "Keyboard Shortcuts" page). This file intentionally covers only the **AI-specific** bindings — everything else is inherited from VS Code (see `seed/vscode.yaml`). Reconcile each key; correct or drop any you can't confirm.

- [ ] **Step 4: Create `seed/cursor.yaml`** (draft — apply corrections from Step 3)

```yaml
app: Cursor
entries:
  - action: Inherits the VS Code keymap
    steps:
      - Cursor is a VS Code fork — all standard editing/navigation shortcuts match VS Code
      - See the "VS Code" entries in keybook for those
    notes: This file lists only Cursor's AI-specific additions.
    tags: [info, vscode]
  - action: Inline edit (edit selection with AI)
    keys: "⌘K"
    tags: [ai, edit]
  - action: Open the AI chat / Ask pane
    keys: "⌘L"
    tags: [ai, chat]
  - action: Open Composer / Agent
    keys: "⌘I"
    tags: [ai, composer, agent]
  - action: Add the current selection to chat
    keys: "⌘⇧L"
    tags: [ai, chat, context]
  - action: Accept an inline (Tab) completion
    keys: "⇥"
    tags: [ai, autocomplete]
  - action: Accept / reject an AI edit
    keys: "⌘⏎, ⌘⌫"
    notes: ⌘⏎ accepts the suggested change; ⌘⌫ rejects it. Verify against the current Cursor docs.
    tags: [ai, diff]
  - action: Open a new AI chat
    keys: "⌘N"
    notes: From within the chat pane.
    tags: [ai, chat]
```

- [ ] **Step 5: Run the seed test to verify it passes**

Run: `pnpm test seed`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add seed/cursor.yaml tests/seed.test.ts
git commit -m "feat(seed): Cursor AI-specific shortcuts"
```

---

## Task 6: New file — `seed/zed.yaml`

**Files:**
- Create: `seed/zed.yaml`
- Modify: `tests/seed.test.ts`

- [ ] **Step 1: Add `"Zed"` to the seed-test coverage array** — `tests/seed.test.ts`

Add `"Zed",` after the `"Cursor",` line.

- [ ] **Step 2: Run the seed test to verify it fails**

Run: `pnpm test seed`
Expected: FAIL — `apps.has("Zed")` is false.

- [ ] **Step 3: Verify keys against the official source** (Zed is NOT installed → docs only)

Fetch Zed's default key bindings: `https://zed.dev/docs/key-bindings` (macOS defaults). Reconcile each key; correct or drop any you can't confirm.

- [ ] **Step 4: Create `seed/zed.yaml`** (draft — apply corrections from Step 3)

```yaml
app: Zed
entries:
  - action: Open the command palette
    keys: "⌘⇧P"
    tags: [commands, palette]
  - action: Open a file by name (file finder)
    keys: "⌘P"
    tags: [open file, goto]
  - action: Project-wide search
    keys: "⌘⇧F"
    tags: [search, find]
  - action: Find / replace in the buffer
    keys: "⌘F, ⌘⌥F"
    tags: [find, replace]
  - action: Add a cursor above / below
    keys: "⌘⌥↑, ⌘⌥↓"
    tags: [multi cursor]
  - action: Select the next occurrence
    keys: "⌘D"
    tags: [multi cursor, select]
  - action: Go to definition
    keys: "F12"
    tags: [navigate]
  - action: Rename symbol
    keys: "F2"
    tags: [refactor]
  - action: Toggle the integrated terminal
    keys: "⌃`"
    tags: [terminal]
  - action: Toggle the project panel
    keys: "⌘⇧E"
    tags: [explorer, files]
  - action: Go to symbol in the buffer
    keys: "⌘⇧O"
    tags: [navigate, outline]
  - action: Open the AI assistant panel
    keys: "⌘?"
    notes: Verify the exact binding against Zed's docs — the assistant binding has changed across versions.
    tags: [ai, assistant]
  - action: Toggle line comment
    keys: "⌘/"
    tags: [comment]
  - action: Format the buffer
    keys: "⌘⇧I"
    tags: [format]
```

- [ ] **Step 5: Run the seed test to verify it passes**

Run: `pnpm test seed`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add seed/zed.yaml tests/seed.test.ts
git commit -m "feat(seed): Zed essentials"
```

---

## Task 7: Extend `seed/vscode.yaml`

**Files:**
- Modify: `seed/vscode.yaml`

The current file already contains (do NOT duplicate): Command Palette `⌘⇧P`, Quick Open `⌘P`, toggle terminal `` ⌃` ``, toggle sidebar `⌘B`, add cursor below `⌘⌥↓`, select next occurrence `⌘D`, go to line `⌃G`, Go to Definition `F12`, Rename `F2`, Find/Replace `⌘F, ⌥⌘F`, find in all files `⌘⇧F`, toggle line comment `⌘/`, move line `⌥↑/↓`, copy line `⇧⌥↑/↓`, Format document `⇧⌥F`, split editor `⌘\`, Quick Fix `⌘.`, Zen Mode `⌘K, Z`, delete line `⌘⇧K`, insert line below/above, select all occurrences `⌘⇧L`, next problem `F8`, navigate back/forward `⌃-, ⌃⇧-`, open Keyboard Shortcuts `⌘K, ⌘S`.

- [ ] **Step 1: Verify keys against the official source**

Fetch the VS Code macOS keybinding reference: `https://code.visualstudio.com/shortcuts/keyboard-shortcuts-macos.pdf`. Confirm each new entry below and that none duplicates an existing `keys`/`action` in the current file.

- [ ] **Step 2: Append the new entries** — at the end of the `entries:` list in `seed/vscode.yaml` (after `Open Keyboard Shortcuts`), add:

```yaml
  - action: Go to Symbol in the file
    keys: "⌘⇧O"
    tags: [navigate, symbol]
  - action: Go to Symbol in the workspace
    keys: "⌘T"
    tags: [navigate, symbol]
  - action: Peek Definition
    keys: "⌥F12"
    tags: [navigate, peek]
  - action: Find All References
    keys: "⇧F12"
    tags: [references]
  - action: Toggle the panel
    keys: "⌘J"
    tags: [panel]
  - action: Fold / unfold the current region
    keys: "⌘⌥[, ⌘⌥]"
    tags: [fold]
  - action: Toggle word wrap
    keys: "⌥Z"
    tags: [wrap]
  - action: Reopen the last closed editor
    keys: "⌘⇧T"
    tags: [restore]
```

- [ ] **Step 3: Validate** — Run: `pnpm test seed`
Expected: PASS (3 tests; zero load errors confirms the new entries are well-formed).

- [ ] **Step 4: Commit**

```bash
git add seed/vscode.yaml
git commit -m "feat(seed): more VS Code navigation and editing shortcuts"
```

---

## Task 8: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `pnpm test`
Expected: all suites PASS, including the seed coverage test with all six new apps.

- [ ] **Step 2: Build and validate the seed via the built CLI**

Run: `pnpm build && KEYBOOK_DATA_DIR="$(mktemp -d)" node dist/cli.js check`
Expected: `✓ N entries OK` (N ≈ 340), exit 0.

- [ ] **Step 3: Lint and typecheck**

Run: `pnpm lint && pnpm typecheck`
Expected: both clean. (If Biome reformats YAML/TS, run `pnpm format` and re-commit.)

- [ ] **Step 4: Commit any formatting fixes (if needed)**

```bash
git add -A
git commit -m "chore(seed): formatting after seed expansion v2"
```

(Skip if nothing changed.)

---

## Self-Review (completed by plan author)

**1. Spec coverage:**
- §3 files: chrome→T1, safari→T2, jetbrains→T3, notion→T4, cursor→T5, zed→T6, vscode extend→T7, seed test→every task's Step 1.
- §4 accuracy: every app task has an explicit "verify against official source" step + live cross-check for the three installed menu-bar apps (T1/T2/T3 Step 4); docs-only fallback noted for Cursor/Zed (T5/T6) and in the accuracy contract.
- §5 per-app coverage: each task's draft matches the spec's coverage list; tips that aren't single keypresses use `steps`/`notes` (JetBrains Search Everywhere, Notion slash-menu, Cursor VS Code-inheritance note).
- §6 testing → T1–T6 Step 1 (test edits) + T8 (full suite, build+check). §7 release is out of plan scope (user-driven) — not a task, correctly.

**2. Placeholder scan:** No TBD/TODO. The "verify and correct the draft" steps are an explicit accuracy procedure (per spec §4), not vague instructions — each names the exact source URL and (where applicable) the live-dump command. Every YAML body is present in full.

**3. Type/consistency:** All entries use only schema fields (`action`, `keys`, `steps`, `command`, `tags`, `notes`). App names match the seed-test additions exactly: `Google Chrome`, `Safari`, `JetBrains`, `Notion`, `Cursor`, `Zed`. Glyph + comma-chord notation matches `edge.yaml`/`vscode.yaml`. No fabricated `keys` on multi-step tips.
