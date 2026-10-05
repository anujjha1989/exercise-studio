#!/usr/bin/env bash
# Stage, verify, back up, install and roll back a source-served release.
set -euo pipefail
cd "${EXERCISE_ROOT:-$(dirname "$0")}"
if [[ -n "$(git status --porcelain --untracked-files=normal)" ]]; then
  echo "Checkout has changes. Commit or move them before updating." >&2; exit 1
fi
# The Pi has node but no npm, and sudo may need a password: neither is required here.
restart_service() {
  if sudo -n systemctl restart exercise-studio 2>/dev/null; then return 0; fi
  # The service runs as this user with Restart=on-failure: stop the process and let systemd bring it back.
  pkill -KILL -f "$(pwd)/server.js" || true
  for _ in 1 2 3 4 5 6 7 8; do sleep 1; systemctl is-active --quiet exercise-studio && return 0; done
  return 1
}
git fetch origin
release_ref="${1:-origin/main}"
release_commit="$(git rev-parse "$release_ref^{commit}")"
previous_commit="$(git rev-parse HEAD)"
git merge-base --is-ancestor HEAD "$release_commit"
release_stage="$(mktemp -d)"
trap 'rm -rf "$release_stage"' EXIT
git archive "$release_commit" | tar -x -C "$release_stage"
(cd "$release_stage" && node scripts/check.js && node --test)
release_backup="${RELEASE_BACKUP_DIR:-$HOME/exercise-studio-releases}/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$release_backup"
git archive HEAD > "$release_backup/source.tar"
if [[ -d data ]]; then tar -czf "$release_backup/data.tar.gz" data; fi
printf '%s\n' "$previous_commit" > "$release_backup/previous-commit"
release_origin="${CHECK_ORIGIN:-http://127.0.0.1:${PORT:-4320}/}"
rollback() {
  echo "Release checks failed. Restoring $previous_commit." >&2
  git reset --hard "$previous_commit"
  restart_service || echo "Could not restart the service. Run: sudo systemctl restart exercise-studio" >&2
  echo "Previous source restored. Data was retained; backup is $release_backup." >&2
}
git merge --ff-only "$release_commit"
if ! restart_service; then rollback; exit 1; fi
release_ok=false
for attempt in 1 2 3 4 5; do
  if node scripts/verify-release.js "$release_origin"; then release_ok=true; break; fi
  sleep 1
done
if [[ "$release_ok" != true ]]; then rollback; exit 1; fi
node -e 'console.log(JSON.stringify({commit:process.argv[1],version:require("./package.json").version,verifiedAt:new Date().toISOString()}))' "$release_commit" > "$release_backup/installed.json"
echo "Verified release $release_commit. Backup: $release_backup"
echo "Before calling release complete, check /exercise/ on your phone over HTTPS, both themes, demos, logging, and offline reopening."
