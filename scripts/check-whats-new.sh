#!/usr/bin/env bash
set -euo pipefail

# Ensures the landing-page "Yang baru" changelog is updated before deploy.
# See src/lib/whats-new.ts and scripts/deploy.sh.

WHATS_NEW_FILE="src/lib/whats-new.ts"
DEPLOY_TAG="${DEPLOY_TAG:-deploy/production}"
TO_REF="${1:-HEAD}"

if [[ "${SKIP_WHATS_NEW_CHECK:-}" == "1" ]]; then
  echo "skip: SKIP_WHATS_NEW_CHECK=1"
  exit 0
fi

if [[ ! -f "$WHATS_NEW_FILE" ]]; then
  echo "error: missing $WHATS_NEW_FILE" >&2
  exit 1
fi

fail() {
  echo "error: $1" >&2
  echo "       Add a Yang baru entry at the top of $WHATS_NEW_FILE before deploying." >&2
  echo "       Override for hotfixes: SKIP_WHATS_NEW_CHECK=1 ./scripts/deploy.sh" >&2
  exit 1
}

# Uncommitted work: if anything else changed locally, whats-new must change too.
if [[ -n "$(git status --porcelain)" ]]; then
  has_whats_new=false
  has_other=false
  while IFS= read -r line; do
    f="${line#?? }"
    if [[ "$f" == "$WHATS_NEW_FILE" ]]; then
      has_whats_new=true
    else
      has_other=true
    fi
  done < <(git status --porcelain)
  if $has_other && ! $has_whats_new; then
    fail "local changes include files other than $WHATS_NEW_FILE"
  fi
fi

# Committed work since last production tag.
if git rev-parse --verify "$DEPLOY_TAG" >/dev/null 2>&1; then
  if git diff --quiet "$DEPLOY_TAG..$TO_REF" 2>/dev/null; then
    echo "ok: no changes since $DEPLOY_TAG — redeploy only."
    exit 0
  fi

  if git diff --quiet "$DEPLOY_TAG..$TO_REF" -- "$WHATS_NEW_FILE"; then
    fail "deploying commits since $DEPLOY_TAG but $WHATS_NEW_FILE was not updated"
  fi

  echo "ok: $WHATS_NEW_FILE updated since $DEPLOY_TAG."
  exit 0
fi

echo "ok: no $DEPLOY_TAG tag yet — first deploy, skipping whats-new gate."
exit 0
