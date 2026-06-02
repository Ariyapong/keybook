# keybook

A self-contained, open-source **macOS TUI** for searching the keyboard
shortcuts and short recipes of your most-used apps. Launch `keybook`,
fuzzy-search by intent ("finder new tab", "terminal here"), and learn your
shortcuts along the way.

## Install

```bash
npm install -g @arthony/keybook
# or run without installing:
npx @arthony/keybook
```

Requires Node 22+ and macOS. The package is published under the `@arthony`
scope, but the commands it installs are still `keybook` (and the `kb` alias).

## Usage

```bash
keybook          # launch the TUI (alias: kb)
keybook path     # print the data directory
keybook edit     # open the data directory in $EDITOR
keybook check    # validate your data files
```

In the TUI: type to fuzzy-search, ↑/↓ to move, ⏎ to copy the shortcut (or a
recipe's command) to the clipboard, ⎋ to quit.

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
