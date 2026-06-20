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
  pnpm bump-tap 0.7.0 --dry-run
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

# --- idempotency: already pointing at this version? ---
if grep -qF -- "$URL" "$FORMULA" && grep -qF -- "$SHA" "$FORMULA"; then
  echo "tap already at $VERSION ($TAP) — nothing to do"
  exit 0
fi

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

# --- preview the change (diff exits 1 when files differ → neutralize under set -e) ---
echo "Proposed: $TAP → $VERSION"
diff -u "$FORMULA" "$PROPOSED" || true

if [ "$DRY_RUN" -eq 1 ]; then
  echo "(dry run — no changes made)"
  exit 0
fi

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
