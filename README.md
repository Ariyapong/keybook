# keybook

A self-contained, open-source **macOS TUI** for searching the keyboard
shortcuts and short recipes of your most-used apps. Launch `keybook`,
fuzzy-search by intent ("finder new tab", "terminal here"), and learn your
shortcuts along the way.

![keybook demo: fuzzy-search a shortcut, then a multi-step recipe](docs/demo/keybook.gif)

## Install

```bash
brew install ariyapong/tap/keybook
```

Or via npm:

```bash
npm install -g @arthony/keybook
# or run without installing:
npx -p @arthony/keybook keybook
```

Requires macOS. The Homebrew tap installs Node 22 automatically; the npm
route assumes you already have Node 22+. Both install the `keybook`
command and the `kb` alias.

**Terminal.app users:** if `⌥⌫` doesn't delete a word in the search input,
enable *Terminal → Settings → Profiles → Keyboard → "Use Option as Meta
key"*, or use `⌃W` (works in any terminal).

## Usage

```bash
keybook          # launch the TUI (alias: kb)
keybook add      # add a new entry (interactive form)
keybook path     # print the data directory
keybook edit     # open the data directory in $EDITOR
keybook check    # validate your data files
```

In the TUI: type to fuzzy-search, ↑/↓ to move, ⏎ to copy the shortcut (or a
recipe's command) to the clipboard, ⎋ to quit.

Manage entries without leaving the search screen: `⌃O` to add, `⌃E` to edit the
selected entry (pre-filled form), `⌃X` to delete it (with a `y/n` confirm). Or
script an add: `keybook add --app Fork --action 'Push' --keys 'shift cmd p' --tags push`
(`--keys` accepts glyphs or words; recipes use repeatable `--step`).

## Your data

Shortcuts live in plain YAML files you own — by default `~/.config/keybook/`
(override with `$KEYBOOK_DATA_DIR`, e.g. point it at a synced/git folder to
share across machines). On first run the directory is seeded from a bundled
starter set; your edits are never overwritten.

Each entry is a key combo **or** a short recipe:

```yaml
app: Finder
entries:
  - action: Open a new tab
    keys: "⌘T"
    tags: [new tab]
  - action: Open Terminal at the current folder
    steps: [Right-click the folder, Services → "New Terminal at Folder"]
    tags: [terminal here]
```

Add entries by hand, or ask an AI assistant to append them and run
`keybook check` before committing.

## Development

Requires Node 22+ and pnpm. One-shot setup after cloning:

```bash
git clone https://github.com/Ariyapong/keybook.git
cd keybook
./scripts/dev-setup.sh    # checks Node, enables pnpm, installs, runs tests
```

Or manually:

```bash
corepack enable           # enables pnpm (or: npm i -g pnpm)
pnpm install
pnpm test                 # run the suite
pnpm build                # bundle to dist/cli.js
pnpm dev                  # run the TUI from source (tsx)
```

Also available: `pnpm typecheck`, `pnpm lint`, `pnpm format`.

**Layout:** `src/data` (zod schema + YAML loader), `src/config.ts` (data dir +
first-run seeding), `src/search.ts` (fzf), `src/tui` (Ink components),
`src/cli.ts` (commander entry), `seed/` (bundled starter data). Design docs are
in `docs/superpowers/`.

## License

MIT
