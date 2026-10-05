#!/usr/bin/env bash
# Stage, verify, back up, install and roll back a source-served release.
set -euo pipefail
cd "${EXERCISE_ROOT:-$(dirname "$0")}"
if [[ -n "$(git status --porcelain --untracked-files=normal)" ]]; then
  echo "Checkout has changes. Commit or move them before updating." >&2; exit 1
fi
sudo -v
git fetch origin
release_ref="${1:-origin/main}"
release_commit="$(git rev-parse "$release_ref^{commit}")"
previous_commit="$(git rev-parse HEAD)"
git merge-base --is-ancestor HEAD "$release_commit"
release_stage="$(mktemp -d)"
trap 'rm -rf "$release_stage"' EXIT
git archive "$release_commit" | tar -x -C "$release_stage"
(cd "$release_stage" && npm run check && npm test)
release_backup="${RELEASE_BACKUP_DIR:-$HOME/exercise-studio-releases}/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$release_backup"
git archive HEAD > "$release_backup/source.tar"
if [[ -d data ]]; then tar -czf "$release_backup/data.tar.gz" data; fi
printf '%s\n' "$previous_commit" > "$release_backup/previous-commit"
release_origin="${CHECK_ORIGIN:-http://127.0.0.1:${PORT:-4320}/}"
rollback() {
  echo "Release checks failed. Restoring $previous_commit." >&2
  git reset --hard "$previous_commit"
  sudo systemctl restart exercise-studio
  echo "Previous source restored. Data was retained; backup is $release_backup." >&2
}
git merge --ff-only "$release_commit"
if ! sudo systemctl restart exercise-studio; then rollback; exit 1; fi
release_ok=false
for attempt in 1 2 3 4 5; do
  if node scripts/verify-release.js "$release_origin"; then release_ok=true; break; fi
  sleep 1
done
if [[ "$release_ok" != true ]]; then rollback; exit 1; fi
node -e 'console.log(JSON.stringify({commit:process.argv[1],version:require("./package.json").version,verifiedAt:new Date().toISOString()}))' "$release_commit" > "$release_backup/installed.json"
echo "Verified release $release_commit. Backup: $release_backup"
echo "Before calling release complete, check /exercise/ on your phone over HTTPS, both themes, demos, logging, and offline reopening."
