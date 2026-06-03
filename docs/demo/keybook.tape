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
Set TypingSpeed 55ms

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
Sleep 1300ms

Type "new tab"
Sleep 1800ms

Down
Sleep 300ms
Down
Sleep 300ms
Down
Sleep 500ms

Enter
Sleep 1100ms

Escape
Sleep 400ms

# Ink leaves residual render in scrollback on exit; clear before the next demo.
Type "clear"
Enter
Sleep 250ms

# Demo 2: fuzzy search for a recipe (multi-step entry)
Type "kb"
Enter
Sleep 1100ms

Type "terminal here"
Sleep 1800ms

Enter
Sleep 1100ms

Escape
Sleep 400ms

Type "clear"
Enter
Sleep 250ms

# Demo 3: add a new entry via ⌃O — the v0.3 marquee feature
Type "kb"
Enter
Sleep 1100ms

Ctrl+O
Sleep 700ms

# App field — navigate Claude → Finder → Fork
Down
Sleep 350ms
Down
Sleep 500ms

# Confirm Fork, advance to Type field (default "shortcut" is fine)
Enter
Sleep 400ms
Ctrl+N
Sleep 500ms

# Action field
Type "Force push"
Sleep 800ms

# Keys field — word-form input gets normalized to glyphs ("⇧⌘K")
Ctrl+N
Sleep 400ms
Type "shift cmd k"
Sleep 1000ms

# Review screen — pause for viewer to read the rendered entry
Enter
Sleep 1700ms

# Confirm save — returns to search with "✓ added" flash
Enter
Sleep 1600ms

Escape
Sleep 600ms
