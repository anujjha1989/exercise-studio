#!/usr/bin/env bash
# Pull the latest version from GitHub and restart the app.
set -euo pipefail
cd "$(dirname "$0")"
git pull --ff-only
if sudo -n systemctl restart exercise-studio 2>/dev/null; then
  echo "Updated and restarted."
else
  # No sudo password to hand: stop the server process and let the service bring it back.
  pkill -KILL -f "$(pwd)/server.js" || true
  sleep 4
  systemctl is-active --quiet exercise-studio && echo "Updated and restarted." || echo "Updated, but the service did not come back. Run: sudo systemctl restart exercise-studio"
fi
