#!/usr/bin/env bash
# One-time installer for the git post-merge hook.
# After `git pull` on the server, the hook auto-runs scripts/deploy.sh
# (build + restart) so frontend dist never goes stale again.
#
# Run once on the server:
#     ~/DT-CW/scripts/install-git-hook.sh

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOOK="$REPO_DIR/.git/hooks/post-merge"

cat > "$HOOK" <<'EOF'
#!/usr/bin/env bash
# Auto-run after `git pull` / `git merge`.
# Rebuilds frontend and restarts backend if production branch is current.
set -e
REPO_DIR="$(cd "$(git rev-parse --show-toplevel)" && pwd)"
branch="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$branch" != "deploy/production" ]]; then
  exit 0
fi
# Skip the git sync step (we're already post-merge) — just build + restart.
"$REPO_DIR/scripts/deploy.sh" --skip-restart >/dev/null 2>&1 || {
  echo "[post-merge] frontend build failed — run scripts/deploy.sh manually"
  exit 0
}
echo "[post-merge] frontend rebuilt. Run: sudo systemctl restart dt-cw"
EOF

chmod +x "$HOOK"
chmod +x "$REPO_DIR/scripts/deploy.sh"
echo "✓ installed $HOOK"
