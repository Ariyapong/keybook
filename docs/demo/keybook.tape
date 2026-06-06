# keybook demo recording — regenerate with:  vhs docs/demo/keybook.tape
#
# Requires `pnpm build` to have run (uses dist/cli.js so the demo is fast
# without needing a global install). Uses a throwaway data dir so the
# recording is reproducible regardless of the user's real ~/.config/keybook.

Output docs/demo/keybook.gif

Set Shell "zsh"
Set FontSize 14
Set Width 1100
Set Height 650
Set Padding 24
Set Theme "Catppuccin Mocha"
Set TypingSpeed 72ms

Env KEYBOOK_DATA_DIR "/tmp/keybook-demo"

# Hidden setup: clean data dir, alias `keybook`/`kb` to the local build,
# pre-seed by running `check` once so the first visible frame is instant.
Hide
Type "rm -rf /tmp/keybook-demo"
Enter
Sleep 100ms
Type "alias keybook='node $PWD/dist/cli.js'"
Enter
Sleep 100ms
Type "alias kb='node $PWD/dist/cli.js'"
Enter
Sleep 100ms
Type "node $PWD/dist/cli.js check >/dev/null"
Enter
Sleep 200ms
Type "clear"
Enter
Sleep 200ms
Show

# Demo 1: fuzzy search for a shortcut across apps
Type "keybook"
Enter
Sleep 1690ms

Type "new tab"
Sleep 2340ms

Down
Sleep 390ms
Down
Sleep 390ms
Down
Sleep 650ms

Enter
Sleep 1430ms

Escape
Sleep 520ms

# Ink leaves residual render in scrollback on exit; clear before the next demo.
Type "clear"
Enter
Sleep 325ms

# Demo 2: fuzzy search for a recipe (multi-step entry)
Type "kb"
Enter
Sleep 1430ms

Type "terminal here"
Sleep 2340ms

Enter
Sleep 1430ms

Escape
Sleep 520ms

Type "clear"
Enter
Sleep 325ms

# Demo 3: add a new entry via ⌃O — the v0.3 marquee feature
Type "kb"
Enter
Sleep 1430ms

Ctrl+O
Sleep 910ms

# App field — navigate Claude → Finder → Fork
Down
Sleep 455ms
Down
Sleep 650ms

# Confirm Fork, advance to Type field (default "shortcut" is fine)
Enter
Sleep 520ms
Ctrl+N
Sleep 650ms

# Action field
Type "Force push"
Sleep 1040ms

# Keys field — word-form input gets normalized to glyphs ("⇧⌘K")
Ctrl+N
Sleep 520ms
Type "shift cmd k"
Sleep 1300ms

# Review screen — pause for viewer to read the rendered entry
Enter
Sleep 2210ms

# Confirm save — returns to search with "✓ added" flash
Enter
Sleep 2080ms

Escape
Sleep 780ms

# Ink leaves residual render in scrollback on exit; clear before the next demo.
Type "clear"
Enter
Sleep 325ms

# Demo 4: edit in place (⌃E) then delete with an inline confirm (⌃X) —
# the v0.4 marquee features, acting on the entry we just added.
Type "kb"
Enter
Sleep 1430ms

Type "force push"
Sleep 1690ms

# ⌃E → the add form, pre-filled, with the app locked to Fork
Ctrl+E
Sleep 1820ms

# Action field — refine the action in place
Ctrl+N
Sleep 520ms
Type " (lease)"
Sleep 1040ms

# Review, then save → "✓ updated" flash, back to search
Enter
Sleep 2080ms
Enter
Sleep 1690ms

# ⌃X → inline "Delete '…'?  y / n" confirm in the footer
Ctrl+X
Sleep 1820ms

# y → "✗ deleted", the entry is removed
Type "y"
Sleep 1690ms

Escape
Sleep 780ms
