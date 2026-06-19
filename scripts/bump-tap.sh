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
