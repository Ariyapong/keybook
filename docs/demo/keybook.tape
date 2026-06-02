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
Sleep 1500ms

Type "new tab"
Sleep 2000ms

Down
Sleep 350ms
Down
Sleep 350ms
Down
Sleep 600ms

Enter
Sleep 1200ms

Escape
Sleep 400ms

# Ink leaves residual render in scrollback on exit; clear before demo 2.
Type "clear"
Enter
Sleep 300ms

# Demo 2: fuzzy search for a recipe (multi-step entry)
Type "kb"
Enter
Sleep 1200ms

Type "terminal here"
Sleep 2200ms

Enter
Sleep 1400ms

Escape
Sleep 800ms
