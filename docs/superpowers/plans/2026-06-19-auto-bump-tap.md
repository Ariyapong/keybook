# Auto-bump Homebrew tap — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A local `scripts/bump-tap.sh` that bumps the Homebrew tap formula to a published npm version (resolve tarball → compute sha256 → rewrite url+sha256 → confirm → commit+push), eliminating the manual edit that lagged in v0.5.0 and v0.6.0.

**Architecture:** One self-contained Bash script under `set -euo pipefail`, built up across three tasks (CLI surface → read-only resolve+dry-run → mutation path), plus a `pnpm bump-tap` alias and a runbook update. No new dependencies; uses `node` (already required), `npm`, `curl`, `shasum`, `awk`, `git`, `brew` — all present on the target macOS machine.

**Tech Stack:** Bash, npm registry reads, Homebrew (`brew --repository`, `brew style`), git.

## Global Constraints

- Target platform is **macOS / darwin** — use BSD-compatible tools: **awk** (POSIX `[[:space:]]`), NOT `sed s///`, for the field replacement.
- Script runs under **`set -euo pipefail`**. Every command whose *normal* path can exit non-zero (`npm view` on a missing version, `grep` on no match, `diff` on a difference, `read` on EOF) MUST be guarded with `if`/`|| true` — never left bare, or the script aborts.
- npm package scope is **`@arthony/keybook`** (read from `package.json` `name`) — intentional, not `ariyapong`.
- Tap repo is **`ariyapong/homebrew-tap`**; refer to it as **`ariyapong/tap`** in all `brew` commands and string matches.
- `$SHA` is the **bare 64-char hex** (field 1 of `shasum`, never the whole `<hex>  <path>` line).
- Commit message convention for the tap: **`chore(formula): keybook <version>`**.
- **No Claude/Anthropic attribution** in commits; plain messages, no `Co-Authored-By` trailer.
- Work happens on branch `chore/auto-bump-tap` (already created). Do not push to `main`.

---

## File Structure

- **Create:** `scripts/bump-tap.sh` — the entire feature; one linear script.
- **Modify:** `package.json` — add `"bump-tap"` to `scripts`.
- **Modify (memory, not git):** `~/.claude/projects/.../memory/keybook-homebrew-release.md` — point the runbook at the script.

---

### Task 1: CLI surface — scaffold, arg parsing, `--help`, pnpm alias

**Files:**
- Create: `scripts/bump-tap.sh`
- Modify: `package.json` (scripts block)

**Interfaces:**
- Produces: an executable `scripts/bump-tap.sh` that parses `[version] [--dry-run] [--help]` order-independently, prints usage on `--help`/`-h` (exit 0) and on unknown flags (exit 2), and sets `VERSION` / `DRY_RUN`. Later tasks append the resolve and mutation logic after the arg-parse block.

- [ ] **Step 1: Create the script with shebang, header, usage, and arg parsing**

```bash
#!/usr/bin/env bash
set -euo pipefail

# bump-tap.sh — bump the Homebrew tap formula (ariyapong/homebrew-tap) to a
# published npm version of @arthony/keybook.
# Design: docs/superpowers/specs/2026-06-19-auto-bump-tap-design.md

TAP="ariyapong/tap"            # Homebrew normalizes the "homebrew-" prefix
FORMULA_REL="Formula/keybook.rb"

usage() {
  cat <<'EOF'
Usage: scripts/bump-tap.sh [version] [--dry-run] [--help]

Bump the Homebrew tap formula to a published npm version of @arthony/keybook:
resolve the tarball, compute its sha256, rewrite the formula's url+sha256, show
the diff, and (after a y/N confirm) commit+push the tap.

Arguments:
  version      Version to bump to. Defaults to package.json's "version".
  --dry-run    Resolve + compute + show the diff only; make no changes.
  --help, -h   Show this help and exit.

Examples:
  scripts/bump-tap.sh                    # bump to package.json version
  scripts/bump-tap.sh 0.7.0
  scripts/bump-tap.sh 0.7.0 --dry-run
  pnpm bump-tap -- 0.7.0 --dry-run
EOF
}

# --- arg parsing (order-independent) ---
VERSION=""
DRY_RUN=0
end_opts=0
for arg in "$@"; do
  if [ "$end_opts" -eq 0 ]; then
    case "$arg" in
      -h|--help) usage; exit 0 ;;
      --dry-run) DRY_RUN=1; continue ;;
      --)        end_opts=1; continue ;;
      --*)       echo "error: unknown flag: $arg" >&2; usage >&2; exit 2 ;;
    esac
  fi
  if [ -n "$VERSION" ]; then
    echo "error: unexpected extra argument: $arg" >&2; usage >&2; exit 2
  fi
  VERSION="$arg"
done
```

- [ ] **Step 2: Make it executable**

Run: `chmod +x scripts/bump-tap.sh`

- [ ] **Step 3: Add the pnpm alias to package.json**

In `package.json`, add `"bump-tap"` to the `scripts` block (after `prepublishOnly`):

```json
    "prepublishOnly": "pnpm build",
    "bump-tap": "./scripts/bump-tap.sh"
```

- [ ] **Step 4: Verify help and bad-flag behavior**

Run:
```bash
./scripts/bump-tap.sh --help; echo "exit=$?"
./scripts/bump-tap.sh -h; echo "exit=$?"
./scripts/bump-tap.sh --bogus; echo "exit=$?"
```
Expected: first two print usage and `exit=0`; the third prints `error: unknown flag: --bogus` + usage and `exit=2`.

- [ ] **Step 5: Verify pnpm forwards args through `--`**

Run: `pnpm bump-tap -- --help; echo "exit=$?"`
Expected: prints usage, `exit=0` (confirms pnpm 10 forwards `--help` to the script; if it does not, the alias/docs must switch to direct `scripts/bump-tap.sh` invocation only — note the result).

- [ ] **Step 6: Commit**

```bash
git add scripts/bump-tap.sh package.json
git commit -m "feat(scripts): bump-tap CLI scaffold + arg parsing"
```

---

### Task 2: Read-only pipeline — resolve, sha256, build proposed, diff, `--dry-run`

**Files:**
- Modify: `scripts/bump-tap.sh` (append after the arg-parse block from Task 1)

**Interfaces:**
- Consumes: `VERSION`, `DRY_RUN`, `TAP`, `FORMULA_REL` from Task 1.
- Produces: resolves `PKG_NAME`, `URL`, `SHA`, `TAP_DIR`, `FORMULA`; writes the candidate formula to `$WORKDIR/proposed.rb`; prints the diff; under `--dry-run` exits 0 with zero side effects. Leaves `WORKDIR`, `FORMULA`, `URL`, `SHA`, `PROPOSED` defined for Task 3.

- [ ] **Step 1: Append the resolve + verify block**

Append to `scripts/bump-tap.sh` (after the arg-parse `done`):

```bash
# --- resolve package + version from package.json ---
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PKG_JSON="$ROOT/package.json"
PKG_NAME="$(node -p "require('$PKG_JSON').name")"
if [ -z "$VERSION" ]; then
  VERSION="$(node -p "require('$PKG_JSON').version")"
fi
SPEC_REF="$PKG_NAME@$VERSION"

# --- verify published + resolve tarball URL (guarded: npm view exits 1 on E404) ---
if ! published="$(npm view "$SPEC_REF" version 2>/dev/null)"; then
  echo "error: not published on npm: $SPEC_REF (publish before bumping the tap)" >&2
  exit 1
fi
if [ "$published" != "$VERSION" ]; then
  echo "error: npm returned '$published' for $SPEC_REF (expected $VERSION)" >&2
  exit 1
fi
if ! URL="$(npm view "$SPEC_REF" dist.tarball 2>/dev/null)"; then
  echo "error: could not resolve tarball URL for $SPEC_REF" >&2
  exit 1
fi
```

- [ ] **Step 2: Append download + sha256 (WORKDIR + trap)**

```bash
# --- download tarball + compute sha256 (field 1 only) ---
WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT
TARBALL="$WORKDIR/pkg.tgz"
if ! curl -fsSL -o "$TARBALL" "$URL"; then
  echo "error: failed to download $URL" >&2
  exit 1
fi
SHA="$(shasum -a 256 "$TARBALL" | awk '{print $1}')"
if [ -z "$SHA" ]; then
  echo "error: failed to compute sha256 of $TARBALL" >&2
  exit 1
fi
```

- [ ] **Step 3: Append formula location (on-disk existence checks)**

```bash
# --- locate the tap formula (brew --repository fabricates a path + exits 0, so check disk) ---
TAP_DIR="$(brew --repository "$TAP")"
if [ ! -d "$TAP_DIR" ]; then
  echo "error: tap not installed: $TAP (run: brew tap ariyapong/tap)" >&2
  exit 1
fi
FORMULA="$TAP_DIR/$FORMULA_REL"
if [ ! -f "$FORMULA" ]; then
  echo "error: formula not found: $FORMULA" >&2
  exit 1
fi
```

- [ ] **Step 4: Append idempotency check (guarded fixed-string grep)**

```bash
# --- idempotency: already pointing at this version? ---
if grep -qF -- "$URL" "$FORMULA" && grep -qF -- "$SHA" "$FORMULA"; then
  echo "tap already at $VERSION ($TAP) — nothing to do"
  exit 0
fi
```

- [ ] **Step 5: Append the awk field-replacement (exactly one url + one sha256 line)**

```bash
# --- build proposed formula: replace exactly the url + sha256 lines (awk, POSIX, -v vars) ---
PROPOSED="$WORKDIR/proposed.rb"
if ! awk -v url="$URL" -v sha="$SHA" '
  {
    if ($0 ~ /^[[:space:]]*url "/) {
      match($0, /^[[:space:]]*/); print substr($0, 1, RLENGTH) "url \"" url "\""; urls++; next
    }
    if ($0 ~ /^[[:space:]]*sha256 "/) {
      match($0, /^[[:space:]]*/); print substr($0, 1, RLENGTH) "sha256 \"" sha "\""; shas++; next
    }
    print
  }
  END {
    if (urls != 1 || shas != 1) {
      printf("error: expected exactly 1 url and 1 sha256 line (got url=%d sha256=%d)\n", urls, shas) > "/dev/stderr"
      exit 3
    }
  }
' "$FORMULA" > "$PROPOSED"; then
  echo "error: could not rewrite formula fields (shape changed?)" >&2
  exit 1
fi
```

- [ ] **Step 6: Append diff preview + `--dry-run` exit**

```bash
# --- preview the change (diff exits 1 when files differ → neutralize under set -e) ---
echo "Proposed: $TAP → $VERSION"
diff -u "$FORMULA" "$PROPOSED" || true

if [ "$DRY_RUN" -eq 1 ]; then
  echo "(dry run — no changes made)"
  exit 0
fi
```

- [ ] **Step 7: Verify the end-to-end dry run (headline acceptance check)**

Run: `./scripts/bump-tap.sh 0.6.0 --dry-run; echo "exit=$?"`
Expected: prints `Proposed: ariyapong/tap → 0.6.0`, an **empty diff**, then `tap already at 0.6.0 … nothing to do`, `exit=0`. (The formula is already at 0.6.0, so the idempotency check at Step 4 fires before the diff — this confirms URL resolution + sha computation produce the value already in the formula.)

Then verify the sha pipeline directly against a *different* published version (forces the diff path):

Run: `./scripts/bump-tap.sh 0.5.0 --dry-run; echo "exit=$?"`
Expected: prints a non-empty diff swapping the `url` to `…/keybook-0.5.0.tgz` and the `sha256` to 0.5.0's hash, then `(dry run — no changes made)`, `exit=0`.

- [ ] **Step 8: Verify the unpublished guard + tap cleanliness**

Run:
```bash
./scripts/bump-tap.sh 99.99.99 --dry-run; echo "exit=$?"
git -C "$(brew --repository ariyapong/tap)" status -s
```
Expected: first prints `error: not published on npm: @arthony/keybook@99.99.99 …` and `exit=1`; the `git status` prints **nothing** (dry runs left the tap untouched).

- [ ] **Step 9: Commit**

```bash
git add scripts/bump-tap.sh
git commit -m "feat(scripts): bump-tap resolve + sha + dry-run pipeline"
```

---

### Task 3: Mutation path — preconditions, apply+validate, confirm, commit+push

**Files:**
- Modify: `scripts/bump-tap.sh` (append after the `--dry-run` exit from Task 2)

**Interfaces:**
- Consumes: `WORKDIR`, `FORMULA`, `FORMULA_REL`, `PROPOSED`, `TAP`, `TAP_DIR`, `VERSION` from Task 2.
- Produces: completes the script — clean-tree precondition, apply with backup, `brew style` validation (revert on fail), TTY/non-TTY confirm, commit+push, revert-on-decline.

- [ ] **Step 1: Append mutation preconditions (clean tree + default-branch warning)**

```bash
# --- preconditions for mutation (explicit form: a && chain short-circuits under set -e) ---
if ! git -C "$TAP_DIR" diff --quiet || ! git -C "$TAP_DIR" diff --cached --quiet; then
  echo "error: tap working tree is dirty; commit or stash in $TAP_DIR first" >&2
  exit 1
fi
default_branch="$(git -C "$TAP_DIR" symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null | sed 's@^origin/@@' || true)"
current_branch="$(git -C "$TAP_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
if [ -n "$default_branch" ] && [ -n "$current_branch" ] && [ "$current_branch" != "$default_branch" ]; then
  echo "warning: tap is on '$current_branch', not default '$default_branch'" >&2
fi
```

- [ ] **Step 2: Append apply + `brew style` validation (revert on failure)**

```bash
# --- apply with backup, then validate; revert on failure ---
BACKUP="$WORKDIR/keybook.rb.bak"
cp "$FORMULA" "$BACKUP"
cp "$PROPOSED" "$FORMULA"

if ! style_out="$(brew style "$TAP/keybook" 2>&1)"; then
  echo "error: brew style failed on the edited formula — reverting:" >&2
  echo "$style_out" >&2
  cp "$BACKUP" "$FORMULA"
  exit 1
fi
```

- [ ] **Step 3: Append confirm + commit/push (TTY) and non-TTY/decline revert**

```bash
# --- confirm, then commit + push; any non-yes (incl. non-TTY) reverts ---
echo
git -C "$TAP_DIR" --no-pager diff -- "$FORMULA_REL"
echo

if [ ! -t 0 ]; then
  echo "stdin is not a TTY — declining (no commit/push); reverting edit."
  cp "$BACKUP" "$FORMULA"
  exit 0
fi

printf 'Commit and push tap to %s? [y/N] ' "$VERSION"
if ! read -r reply; then reply=""; fi
case "$reply" in
  y|Y|yes|YES)
    git -C "$TAP_DIR" add "$FORMULA_REL"
    git -C "$TAP_DIR" commit -m "chore(formula): keybook $VERSION"
    git -C "$TAP_DIR" push
    echo "pushed: $(git -C "$TAP_DIR" log -1 --format='%h %s')"
    ;;
  *)
    echo "declined — reverting edit, no changes made."
    cp "$BACKUP" "$FORMULA"
    exit 0
    ;;
esac
```

- [ ] **Step 4: Verify the mutation path SAFELY via non-TTY decline (no push)**

This exercises apply + `brew style` + revert without ever committing or pushing, by bumping to the *older* published 0.5.0 (differs from the formula's 0.6.0, so it passes idempotency and reaches the mutation path) with a non-TTY stdin (auto-declines):

Run:
```bash
printf '' | ./scripts/bump-tap.sh 0.5.0; echo "exit=$?"
TAP_DIR="$(brew --repository ariyapong/tap)"
git -C "$TAP_DIR" status -s
grep -c 'keybook-0.6.0.tgz' "$TAP_DIR/Formula/keybook.rb"
```
Expected: the script prints the proposed diff, then `stdin is not a TTY — declining … reverting edit.`, `exit=0`; `git status` prints **nothing** (reverted clean); the `grep -c` prints `1` (formula still at 0.6.0). Also try `echo n | ./scripts/bump-tap.sh 0.5.0` → same revert behavior.

- [ ] **Step 5: Verify `brew style` validation path on the real formula**

Run: `./scripts/bump-tap.sh 0.5.0 --dry-run >/dev/null && echo "resolve+build ok"` then `shellcheck scripts/bump-tap.sh && echo "shellcheck clean"` (skip the shellcheck line with a note if `shellcheck` is not installed).
Expected: `resolve+build ok`; `shellcheck clean` (or a noted skip). Confirm the tap is still clean: `git -C "$(brew --repository ariyapong/tap)" status -s` prints nothing.

- [ ] **Step 6: Commit**

```bash
git add scripts/bump-tap.sh
git commit -m "feat(scripts): bump-tap commit+push with confirm + revert safety"
```

---

### Task 4: Update the release runbook (memory)

**Files:**
- Modify (memory, NOT git): `~/.claude/projects/-Users-tony-ariya-Work-MyProjects-keybook/memory/keybook-homebrew-release.md`

**Interfaces:**
- Consumes: the finished `scripts/bump-tap.sh` and its `pnpm bump-tap` alias.
- Produces: a runbook that points at the script instead of the manual url+sha256 edit.

- [ ] **Step 1: Read the current runbook**

Run: read `~/.claude/projects/-Users-tony-ariya-Work-MyProjects-keybook/memory/keybook-homebrew-release.md` to see the existing manual steps.

- [ ] **Step 2: Replace the manual bump step**

Edit the runbook so the formula-bump step reads: after `npm publish`, run `pnpm bump-tap -- <version>` (or `scripts/bump-tap.sh <version>`) from the keybook repo — it resolves the tarball, computes sha256, rewrites url+sha256, shows the diff, and on `y` commits + pushes the tap. Keep the manual steps as a fallback note. Add a `[[keybook-status]]` link if not present.

- [ ] **Step 3: No git commit** — the memory file lives outside the repo. Confirm with `git status` that nothing in the repo changed in this task.

---

## Self-Review

**Spec coverage:**
- Interface (`[version] [--dry-run] [--help]`, pnpm alias, order-independent parsing) → Task 1.
- Flow steps 1–8 (resolve, verify, sha, locate, idempotency, build, diff, dry-run) → Task 2.
- Flow steps 9–11 (preconditions, apply+validate, confirm/commit/push, non-TTY, revert) → Task 3.
- All 10 `set -e` must-fixes → encoded in the exact code (guarded `npm view`/`grep`/`diff`, awk-not-sed, `shasum | awk '{print $1}'`, on-disk tap checks, explicit clean-tree `if`, guarded `read`).
- Tarball-integrity non-goal, naming notes → captured in Global Constraints; no code needed.
- Testing/verification (0.6.0 dry-run, unpublished guard, --help, shellcheck) → Task 2 Steps 7–8, Task 3 Steps 4–5, Task 1 Step 4.
- Docs runbook update → Task 4.

**Placeholder scan:** No TBD/TODO; every code step shows complete code; every verify step shows the command + expected output.

**Type/name consistency:** `WORKDIR`, `FORMULA`, `FORMULA_REL`, `PROPOSED`, `URL`, `SHA`, `TAP`, `TAP_DIR`, `VERSION`, `DRY_RUN` defined in Tasks 1–2 and consumed consistently in Task 3. Commit-message convention identical across spec and plan.
