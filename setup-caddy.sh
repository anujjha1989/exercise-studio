#!/usr/bin/env bash
# Adds Exercise Studio to the main Caddy site as /exercise/ (so it is reachable at
# https://<pi>.ts.net/exercise/ through the existing Tailscale serve on port 443).
# Run on the Pi:  sudo bash setup-caddy.sh
set -euo pipefail
CF=/etc/caddy/Caddyfile
ANCHOR='redir /home-tv /home-tv/ 302'
[ "$(id -u)" = 0 ] || { echo "Run with sudo: sudo bash $0"; exit 1; }
if grep -q '/exercise/' "$CF"; then echo "Caddy already has /exercise/. Nothing to do."; exit 0; fi
grep -qF "$ANCHOR" "$CF" || { echo "Could not find the expected place in $CF. Nothing changed."; exit 1; }
BK="$CF.backup-before-exercise"
cp -p "$CF" "$BK"
awk -v a="$ANCHOR" '{print} index($0,a){print "\tredir /exercise /exercise/ 302";print "";print "\thandle_path /exercise/* {";print "\t\treverse_proxy 127.0.0.1:4320";print "\t}"}' "$BK" > "$CF"
if caddy validate --config "$CF" --adapter caddyfile >/dev/null 2>&1; then
  systemctl reload caddy
  echo "Done. Open https://$(hostname).tail549492.ts.net/exercise/"
else
  cp -p "$BK" "$CF"
  echo "The new config did not validate, so the original was restored. Nothing changed."
  exit 1
fi
