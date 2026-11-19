#!/usr/bin/env bash
# Install every Claude Code plugin this repo ships, straight from the clone.
#
#   bash scripts/install-plugins.sh
#
# No marketplace account and no access to any private repo: the plugins live in
# this repo, and .claude-plugin/marketplace.json is the index. Restart Claude Code
# afterwards so it picks up the new skills.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
MANIFEST="$ROOT/.claude-plugin/marketplace.json"

command -v claude >/dev/null 2>&1 || {
  echo "✖ The 'claude' command isn't on your PATH."
  echo "  Install Claude Code first: https://claude.com/claude-code"
  exit 1
}
command -v node >/dev/null 2>&1 || { echo "✖ Node 20+ is required."; exit 1; }
[ -f "$MANIFEST" ] || { echo "✖ No marketplace manifest at $MANIFEST"; exit 1; }

MARKET=$(node -e "process.stdout.write(require('$MANIFEST').name)")
PLUGINS=$(node -e "process.stdout.write(require('$MANIFEST').plugins.map(p => p.name).join(' '))")

echo "Registering this repo as a plugin marketplace ('$MARKET')…"
# 'add ./' is required — a bare '.' is rejected as an invalid source.
(cd "$ROOT" && claude plugin marketplace add ./) || \
  (cd "$ROOT" && claude plugin marketplace update "$MARKET")

for p in $PLUGINS; do
  echo
  echo "Installing ${p}…"
  claude plugin install "$p@$MARKET"
done

echo
echo "Done. Restart Claude Code, then say: build me an app"
