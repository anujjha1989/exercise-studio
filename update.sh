#!/usr/bin/env bash
# Pull the latest version from GitHub and restart the app.
set -euo pipefail
cd "$(dirname "$0")"
git pull --ff-only
sudo systemctl restart exercise-studio
echo "Updated."
