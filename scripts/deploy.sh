#!/usr/bin/env bash
# Server-side deploy script for DT-CW.
#
# Usage (on the production server):
#     ~/DT-CW/scripts/deploy.sh [--skip-build] [--skip-restart]
#
# Safe to run repeatedly. Does:
#   1. git fetch + fast-forward pull (refuses if local has divergent commits)
#   2. pip install -r requirements.txt (if backend deps changed)
#   3. npm ci + npm run build (unless --skip-build)
#   4. systemctl restart dt-cw (unless --skip-restart)
#
# Exit codes:
#   0  success
#   1  pre-flight failure (dirty tree, wrong branch, network, etc.)
#   2  build failure
#   3  restart failure

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BRANCH="${DEPLOY_BRANCH:-deploy/production}"
SKIP_BUILD=0
SKIP_RESTART=0

for arg in "$@"; do
  case "$arg" in
    --skip-build)   SKIP_BUILD=1   ;;
    --skip-restart) SKIP_RESTART=1 ;;
    *) echo "unknown arg: $arg" >&2; exit 1 ;;
  esac
done

echo "▶ deploy: $REPO_DIR (branch $BRANCH)"
cd "$REPO_DIR"

# --- 1. git sync -----------------------------------------------------------
if [[ -n "$(git status --porcelain | grep -vE '^\?\? ')" ]]; then
  echo "✗ working tree has uncommitted tracked changes; aborting"
  git status --short
  exit 1
fi

current_branch="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$current_branch" != "$BRANCH" ]]; then
  echo "✗ on branch '$current_branch', expected '$BRANCH'"
  exit 1
fi

before_sha="$(git rev-parse HEAD)"
git fetch origin "$BRANCH"
git merge --ff-only "origin/$BRANCH"
after_sha="$(git rev-parse HEAD)"

if [[ "$before_sha" == "$after_sha" ]]; then
  echo "  already up to date ($after_sha)"
else
  echo "  pulled $before_sha → $after_sha"
fi

# --- 2. backend deps -------------------------------------------------------
if git diff --name-only "$before_sha" "$after_sha" | grep -q '^backend/requirements.txt$'; then
  echo "▶ backend deps changed, running pip install"
  "$REPO_DIR/backend/venv/bin/pip" install -r "$REPO_DIR/backend/requirements.txt"
fi

# --- 3. frontend build -----------------------------------------------------
if (( SKIP_BUILD == 0 )); then
  echo "▶ building frontend"
  cd "$REPO_DIR/frontend"
  npm ci --silent
  npm run build
  cd "$REPO_DIR"
else
  echo "▶ skipping frontend build"
fi

# --- 4. restart backend ----------------------------------------------------
if (( SKIP_RESTART == 0 )); then
  echo "▶ restarting dt-cw.service"
  sudo systemctl restart dt-cw.service
  sleep 2
  if ! systemctl is-active --quiet dt-cw.service; then
    echo "✗ dt-cw.service failed to start"
    sudo systemctl status dt-cw.service --no-pager | tail -20
    exit 3
  fi
  echo "  dt-cw.service running"
else
  echo "▶ skipping backend restart"
fi

echo "✓ deploy complete"
