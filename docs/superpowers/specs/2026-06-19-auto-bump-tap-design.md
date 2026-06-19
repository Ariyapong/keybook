# Auto-bump Homebrew tap — design

**Date:** 2026-06-19
**Status:** approved (brainstorming); spec adversarially reviewed + revised

## Problem

keybook's release is user-driven and local: the maintainer bumps the version, tags,
and runs `npm publish` (which requires 2FA from their machine). The final step —
updating the Homebrew formula in the tap repo with the new tarball `url` and
`sha256` — is a manual hand-edit (download the tarball, compute the sha, edit
`Formula/keybook.rb`, commit, push).

That manual step lagged in **both v0.5.0 and v0.6.0**: npm and the GitHub Release
were already done while the formula still pointed at the previous version, so a
`brew upgrade` would not pick up the new release until a later catch-up edit.

## Goal

A single local command that bumps the tap formula to an already-published npm
version — eliminating the manual url+sha256 edit — while keeping one human
confirmation in the loop (the maintainer is already present at publish time for
the npm 2FA prompt).

## Non-goals (YAGNI)

- Version bump / git tag / `npm publish` — stay manual; `npm publish` needs 2FA.
- Any CI / GitHub Actions automation or cross-repo tokens (the rejected alternative).
- Touching anything in the formula other than the `url` and `sha256` fields.
- **Tarball-byte integrity cross-check.** npm exposes only a SHA-1 `dist.shasum`,
  so the script computes its own sha256 of the downloaded tarball (step 4).
  Download integrity relies on TLS plus Homebrew's own sha256 re-verification at
  install time (`brew fetch`/`brew install` re-hash the download against the
  formula). We do not add a separate `dist.integrity` (sha512) cross-check.

## Naming notes (so a plan-writer doesn't "correct" them)

- The npm package scope is genuinely **`@arthony/keybook`** (confirmed in
  `package.json` and on npm) — not `ariyapong`. Do not "fix" it.
- The tap repo is **`ariyapong/homebrew-tap`**; in all `brew` commands it is
  referred to as **`ariyapong/tap`** (Homebrew normalizes the `homebrew-` prefix).
  Use the `ariyapong/tap` form consistently in commands and string matches.

## Interface

```
scripts/bump-tap.sh [version] [--dry-run] [--help]
```

- `version` (optional positional): the version to bump the formula to. Defaults to
  the `version` field of the repo's `package.json` — i.e. the just-published
  version, kept as the single source of truth.
- `--dry-run`: perform all read-only work (resolve, download, compute sha, build the
  proposed formula, show the diff) and make **no** file or git changes.
- `--help` / `-h`: print usage and exit 0 **before** any network or file work.
- `PKG` (the package name) is read from `package.json` (`name`) so it is not
  hard-coded.

**Arg parsing.** Order-independent loop: `--help`/`-h` short-circuits; `--dry-run`
is accepted in any position; the first non-`-`-prefixed token becomes `VERSION`; a
bare `--` ends option parsing; any unknown `--flag` is a usage error. This ensures
`--dry-run` is never mistaken for the version.

**Convenience alias.** Add to `package.json` scripts: `"bump-tap":
"./scripts/bump-tap.sh"`. **Verified against pnpm 10:** pnpm forwards args to the
script *without* needing a `--` separator — and passing one is harmful, because
pnpm forwards the literal `--` through to the script, where it ends option parsing
and turns a following `--dry-run` into a rejected positional. The documented
invocations are therefore `pnpm bump-tap <version>`, `pnpm bump-tap <version>
--dry-run`, and `pnpm bump-tap --help` (no `--`). Direct `scripts/bump-tap.sh …`
always works.

## Behavior / flow

> **`set -e` discipline (applies throughout):** the script runs under
> `set -euo pipefail`. Every command that is *expected* to exit non-zero on a
> normal path — `npm view` on an unpublished version, `grep` on no match, `diff`
> on a difference — MUST be wrapped in an `if`/guard or `|| true`, never left bare,
> or `set -e` aborts before the intended handling. Each step below specifies the
> guarded form.

1. **Parse args** (see Interface). Resolve `VERSION` (positional arg, else
   `.version` from `package.json`) and `PKG` (`.name` from `package.json`).
2. **Verify published.** Guarded read — `if ! published=$(npm view "$PKG@$VERSION"
   version 2>/dev/null); then` print `not published: $PKG@$VERSION` to stderr and
   `exit 1`. Then confirm `$published` equals `$VERSION`. (`npm view` exits 1 / E404
   on a missing version, so the bare assignment must not run under `set -e`.)
3. **Resolve tarball URL.** Same guarded form:
   `if ! URL=$(npm view "$PKG@$VERSION" dist.tarball 2>/dev/null); then` error +
   `exit 1`. `$URL` is the authoritative registry URL npm serves
   (`https://registry.npmjs.org/@arthony/keybook/-/keybook-$VERSION.tgz`).
4. **Compute sha256.** Create the work dir first: `WORKDIR=$(mktemp -d)` and
   immediately install `trap 'rm -rf "$WORKDIR"' EXIT` (before any step that can
   exit). Download `$URL` with `curl -fsSL -o "$WORKDIR/pkg.tgz"`, then
   `SHA=$(shasum -a 256 "$WORKDIR/pkg.tgz" | awk '{print $1}')`. `$SHA` is the bare
   64-char hex (field 1 only — `shasum` prints `<hex>  <path>`; the path must not
   leak into the formula).
5. **Locate the formula.** `TAP_DIR=$(brew --repository ariyapong/tap)`;
   `FORMULA="$TAP_DIR/Formula/keybook.rb"`. `brew --repository` fabricates a path
   and exits 0 even for a non-existent tap, so existence MUST be checked on disk:
   `[ -d "$TAP_DIR" ]` (else `tap not installed`, exit 1) and `[ -f "$FORMULA" ]`
   (else `formula not found`, exit 1).
6. **Idempotency check.** Fixed-string match (the URL/sha contain regex-significant
   chars): `if grep -qF -- "$URL" "$FORMULA" && grep -qF -- "$SHA" "$FORMULA"; then`
   print `tap already at $VERSION` and `exit 0`. Wrapped in `if` so the normal
   no-match (pre-bump) case does not abort under `set -e`.
7. **Build proposed content.** Produce a candidate formula at `$WORKDIR/proposed.rb`
   by an anchored, line-oriented replacement of exactly two top-level fields,
   preserving indentation. Use **awk with POSIX `[[:space:]]`** and `-v` variables
   (NOT `sed s///`): BSD/macOS `sed` lacks `\s`, and `$URL`/`$SHA` contain `/`, `@`,
   and possibly `&` that would corrupt a `sed` replacement. awk matches
   `/^[[:space:]]*url "/` and `/^[[:space:]]*sha256 "/`, rebuilds each line from the
   `-v` variable while keeping its leading whitespace, and counts replacements; in
   `END`, `exit 3` unless exactly one `url` and one `sha256` line were replaced.
   Check awk's exit via `if` (not `grep -c`, which has the same no-match pitfall).
8. **Preview diff.** `diff -u "$FORMULA" "$WORKDIR/proposed.rb" || true` (diff exits
   1 whenever files differ — the normal bump case — so the status must be
   neutralized). Under `--dry-run`: after printing the diff, `exit 0` is reached
   unconditionally (no file/git mutation has occurred). **Zero side effects.**
9. **Preconditions for mutation** (non-dry-run only). Clean-tree check in explicit
   error form (a `&&` chain in a tested position would short-circuit and let a dirty
   tree through under `set -e`):
   `if ! git -C "$TAP_DIR" diff --quiet || ! git -C "$TAP_DIR" diff --cached
   --quiet; then` print `tap tree dirty` and `exit 1`. Warn (not fail) if the tap is
   not on its default branch.
10. **Apply + validate.** Copy `$WORKDIR/proposed.rb` over `$FORMULA` (the original
    is preserved as `$WORKDIR/keybook.rb.bak`, taken before the copy). Run
    `brew style ariyapong/tap/keybook`. On failure → restore the backup and
    `exit 1`. (`ruby -c "$FORMULA"` is optional defense-in-depth; not required since
    the step-7 exactly-once guard already protects formula shape.)
11. **Confirm.** Print `git -C "$TAP_DIR" diff -- Formula/keybook.rb`, then prompt
    `Commit and push tap to <version>? [y/N]`.
    - **Non-TTY stdin** (CI, piped): treat as declined — restore the backup and
      `exit 0`. Never auto-push. (A `--yes` flag is out of scope.)
    - `y` → `git -C "$TAP_DIR" add Formula/keybook.rb`,
      `commit -m "chore(formula): keybook $VERSION"` (matches the existing tap
      convention), `push`; print the pushed commit.
    - anything else → restore the backup (revert the edit) so the tap is left clean,
      print that nothing was changed, `exit 0`.

## Error handling

- `set -euo pipefail`, with the `set -e` discipline above: no bare command whose
  normal path can exit non-zero.
- One `WORKDIR=$(mktemp -d)` holds the downloaded tarball, the proposed formula, and
  the `.bak` backup; `trap 'rm -rf "$WORKDIR"' EXIT` (installed immediately after
  `mktemp -d`) cleans everything on any exit, including Ctrl-C — so no `.bak` is ever
  left next to the formula.
- The backup is restored before every non-success exit after step 10 (validation
  failure, declined/non-TTY confirm), so the tap is never left with a stray
  uncommitted edit.
- Each external step has an explicit, specific failure message on stderr.

## Testing / verification

No bash test framework exists in this repo, so verification is empirical against
live npm and the real tap. The review already confirmed the load-bearing facts
(below); these are the acceptance checks for the implementation:

- **End-to-end dry run:** `scripts/bump-tap.sh 0.6.0 --dry-run` resolves the real
  published tarball, computes sha
  `3bb45125bec786a69e41d9c4cc772d7e4a902f6251db87e90ed751d05acfd816`, and produces
  an **empty diff** (the formula is already at 0.6.0) — exit 0, no mutation. This
  proves URL resolution + sha computation end-to-end. *(Verified during spec review:
  this exact sha is the byte-for-byte sha256 of the live 0.6.0 tarball and the
  value already in the formula.)*
- **Unpublished guard:** `scripts/bump-tap.sh 99.99.99 --dry-run` errors cleanly
  with `not published` and exit 1 (not an unguarded `npm view` abort).
- `scripts/bump-tap.sh --help` prints usage and exits 0 before any network work.
- `shellcheck scripts/bump-tap.sh` is clean (if `shellcheck` is installed).
- A real future release exercises the full commit+push path for the actual bump.

**What `--dry-run` does NOT cover:** it skips the step-9 clean-tree check and the
step-10 `brew style` validation, so a clean dry-run is not proof the real run will
succeed — it validates arg parsing, npm resolution, sha computation, formula
location, and the field-replacement shape only.

## Docs

- Update the `keybook-homebrew-release.md` memory runbook to reference
  `pnpm bump-tap <version>` (or `scripts/bump-tap.sh <version>`) as the
  formula-bump step, replacing the manual url+sha256 instructions.
