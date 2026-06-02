# Recording the keybook demo GIF

A guidebook for re-recording `keybook.gif` from `keybook.tape` — what each
piece of the tape does, why the visual choices look the way they do, and the
gotchas you'll hit if you change things.

## Quick regenerate

```bash
pnpm build
vhs docs/demo/keybook.tape
gifsicle -O3 --lossy=30 --colors 128 docs/demo/keybook.gif -o docs/demo/keybook.gif
```

Three commands, fully reproducible. The tape uses a throwaway
`KEYBOOK_DATA_DIR` (`/tmp/keybook-demo`) so it never touches your real
`~/.config/keybook`.

One-time tooling install:

```bash
brew install vhs gifsicle
```

VHS bundles its own `ttyd` and uses `ffmpeg`; `gifsicle` is the post-processor.

## Tool: VHS by Charm

VHS records by **scripting**, not capturing. You write a `.tape` file
describing keystrokes and timing; VHS spawns a headless terminal (ttyd),
replays the script, captures frames via ffmpeg, and writes a GIF.

| | VHS | asciinema | QuickTime |
|---|---|---|---|
| Reproducible from source | yes, commit the tape | partial, cast is interactive | no |
| Drives an Ink TUI cleanly | yes | yes | yes |
| Re-record on TUI changes | rerun one command | rerecord by hand | rerecord by hand |
| Output | GIF / MP4 / WebM | needs JS player or `agg` → GIF | mov, convert manually |

For a CLI that keeps evolving, the committed tape pays for itself.

## Anatomy of the tape

The file `keybook.tape` (in this directory) has four sections.

### 1. Output and visual settings

This is most of the "looks amazing":

```
Output docs/demo/keybook.gif
Set FontSize 14
Set Width 1100
Set Height 650
Set Padding 24
Set Theme "Catppuccin Mocha"
Set TypingSpeed 55ms
```

What matters most:

- **`Width 1100 × Height 650`** — wide enough for keybook's split-pane TUI
  (result list + preview); tall enough for ~30 rows of results to be visible.
  Wider than ~1200 starts to feel oversized in a README at half-width.
- **`Theme "Catppuccin Mocha"`** — dark with muted accents. Bright/high-
  contrast themes (Dracula, Tokyo Night) muddy small text after GIF
  compression. Muted palettes stay readable.
- **`TypingSpeed 55ms`** — the sweet spot for "live demo" feel. Under 40ms
  feels robotic; over 80ms drags.
- **`Padding 24`** — makes the terminal feel embedded, not raw.

### 2. Reproducibility via env + hidden setup

```
Env KEYBOOK_DATA_DIR "/tmp/keybook-demo"

Hide
Type "rm -rf /tmp/keybook-demo"               Enter
Type "alias keybook='node $PWD/dist/cli.js'"  Enter
Type "alias kb='node $PWD/dist/cli.js'"       Enter
Type "node $PWD/dist/cli.js check >/dev/null" Enter
Type "clear"                                  Enter
Show
```

`Hide` / `Show` are critical. They let you do all the setup invisibly:

- **Clean data dir** so first-run seeding is deterministic.
- **Alias `keybook` / `kb`** to the local build so the on-screen command
  looks like the real end-user UX without needing `npm i -g`.
- **Pre-seed** with `... check >/dev/null` so the first visible TUI render
  is instant; otherwise the demo opens with a stutter from `cpSync`-ing
  seed files into the data dir.
- **`clear`** so the visible portion starts on a fresh prompt.

The `Env` directive sets the env var for the whole VHS-launched shell,
which the aliased `node dist/cli.js` then inherits.

### 3. The visible demo (two flows, ~14s total)

```
Type "keybook" Enter                # boot TUI
Type "new tab"                      # filter results
Down Down Down                      # navigate
Enter                               # copy (shows "copied!")
Escape                              # quit

Type "clear" Enter                  # see "Ink gotcha" below

Type "kb" Enter                     # boot via alias
Type "terminal here"                # filter recipes
Enter                               # copy recipe
Escape
```

These two flows are chosen to showcase **both Entry types the schema
supports**: a single `keys: ⌘T` and a multi-step `steps: [...]` recipe.
In 14 seconds the viewer sees the whole product.

### 4. Sleeps as choreography

Each `Sleep` is timed for the eye, not the CPU:

```
Type "new tab"           # ~385ms to type
Sleep 2000ms             # 2s to let the viewer SEE the filter narrow
Down  Sleep 350ms        # 350ms per step — perceptible but quick
Enter Sleep 1200ms       # long enough to register "copied!"
Escape Sleep 400ms       # quick exit
```

Rule of thumb:

- **After a non-obvious state change, sleep ~1–2s.**
- **Between mechanical keystrokes (Down, Down) 300–500ms** is enough.

Tightening these sleeps is the single biggest lever on demo "snappiness."

## Ink-specific gotcha

Ink doesn't use the alternate screen buffer by default. When the first TUI
exits, its render stays in the scrollback. If you launch a second TUI
immediately, the new render overlaps the old. The fix is a visible
`clear` + `Enter` between runs:

```
Escape Sleep 400ms
Type "clear" Enter Sleep 300ms     # the magic line
Type "kb" Enter
```

To debug a tape that "feels off," extract still frames with ffmpeg:

```bash
ffmpeg -i docs/demo/keybook.gif -ss 8 -frames:v 1 /tmp/frame.png
# then open /tmp/frame.png to see what's actually rendered at second 8
```

That's how this overlap was caught the first time.

## Post-processing

```bash
gifsicle -O3 --lossy=30 --colors 128 raw.gif -o keybook.gif
```

Takes a raw VHS GIF from **2.6 MB → 1.66 MB** (~37%) with no visible
quality loss. The knobs:

- **`-O3`** — maximum lossless optimization (always safe).
- **`--lossy=30`** — gentle lossy quantization. `80` is visibly soft on
  result-list text; `30` is invisible at viewing size.
- **`--colors 128`** — terminal palettes use under 50 colors; 128 is
  plenty.

If you ever need a smaller file, `--lossy=80 --colors 64` gets to ~1.2 MB
but text starts to fuzz. Don't go below that for a primary README demo.

## Narrative principle

The "amazing" part isn't really the tooling — it's that the demo answers
**"what is this and why would I use it"** in under 15 seconds, with a
clear arc:

> type → results narrow → pick → copy → success

Showing two flows (shortcut + recipe) doubles the information bandwidth
without doubling the runtime. Resist the urge to demo every feature —
pick the two that prove the core value, and end before the viewer's
attention wanders.

## Checklist when re-recording

1. Bump or change something user-visible? Update the `Type` strings if
   the on-screen commands or queries should change.
2. Run `pnpm build` so `dist/cli.js` reflects the change.
3. Run `vhs docs/demo/keybook.tape` and watch it generate.
4. Skim sample frames with `ffmpeg ... -ss N -frames:v 1` — especially
   the start (around 1.5s), the copy moments (around the "copied!"
   indicators), and the transition between flows.
5. Run `gifsicle` to optimize.
6. Commit both `keybook.tape` and `keybook.gif` in the same commit so
   they don't drift.
