#!/usr/bin/env bash
# One-shot dev bootstrap for keybook. Run from the repo root after cloning:
#   ./scripts/dev-setup.sh
set -euo pipefail

echo "==> keybook dev setup"

# Require Node 22+
NODE_MAJOR="$(node -v 2>/dev/null | sed -E 's/^v([0-9]+).*/\1/')"
if [ -z "${NODE_MAJOR:-}" ]; then
  echo "Node is not installed. Install Node 22+ (see .nvmrc), then re-run." >&2
  exit 1
fi
if [ "$NODE_MAJOR" -lt 22 ]; then
  echo "Node v$NODE_MAJOR found, but keybook needs Node 22+." >&2
  echo "With nvm:  nvm install 22 && nvm use" >&2
  exit 1
fi
echo "==> node $(node -v) OK"

# Ensure pnpm is available
if ! command -v pnpm >/dev/null 2>&1; then
  echo "==> pnpm not found; enabling via corepack"
  corepack enable || { echo "Could not enable pnpm. Install it: npm i -g pnpm" >&2; exit 1; }
fi
echo "==> pnpm $(pnpm -v) OK"

echo "==> pnpm install"
pnpm install

echo "==> pnpm test"
pnpm test

echo ""
echo "Ready. Launch it with:  pnpm build && node dist/cli.js   (or: pnpm dev)"
