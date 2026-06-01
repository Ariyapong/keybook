# keybook

A self-contained, open-source **macOS TUI** for searching the keyboard
shortcuts and short recipes of your most-used apps. Launch `keybook`,
fuzzy-search by intent ("finder new tab", "terminal here"), and learn your
shortcuts along the way.

## Install

```bash
npm install -g keybook
# or run without installing:
npx keybook
```

Requires Node 22+ and macOS.

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

## License

MIT
