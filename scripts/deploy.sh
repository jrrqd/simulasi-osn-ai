#!/usr/bin/env bash
set -euo pipefail

# Repeatable deploy for Simulasi OSN AI.
# Usage:
#   REMOTE=ubuntu@host ./scripts/deploy.sh
# Or just ./scripts/deploy.sh (defaults to the prod VPS).
#
# Before syncing, verifies src/lib/whats-new.ts was updated when shipping
# new changes (landing-page "Yang baru" section). Override with
# SKIP_WHATS_NEW_CHECK=1 for emergency hotfixes.

REMOTE="${REMOTE:-ubuntu@43.134.182.44}"
BUILD=/opt/osnai-build
APP=/var/www/osnai
DEPLOY_TAG="${DEPLOY_TAG:-deploy/production}"
RSYNC_EXCLUDES=(
  --exclude node_modules
  --exclude .next
  --exclude .git
  --exclude .data
  --exclude .env.local
)

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Checking landing-page changelog (Yang baru)"
./scripts/check-whats-new.sh

echo "==> Syncing source to ${REMOTE}:${BUILD}"
rsync -az --delete "${RSYNC_EXCLUDES[@]}" ./ "$REMOTE:$BUILD/"

echo "==> Installing deps and building on remote"
ssh "$REMOTE" "cd $BUILD && npm ci && npm run build"

echo "==> Promoting ${BUILD} -> ${APP}"
ssh "$REMOTE" "\
  sudo rsync -az --delete --exclude figures $BUILD/.next/standalone/ $APP/ && \
  sudo rsync -az --delete $BUILD/.next/static/ $APP/.next/static/ && \
  sudo rsync -az --delete $BUILD/public/ $APP/public/ && \
  sudo mkdir -p $APP/figures && \
  sudo chown -R osnai:osnai $APP"

echo "==> Restarting osnai.service"
ssh "$REMOTE" "sudo systemctl restart osnai && sleep 3 && systemctl is-active osnai"

echo "==> Tagging ${DEPLOY_TAG} at HEAD (local)"
git tag -f "$DEPLOY_TAG" HEAD

echo "==> Done."
