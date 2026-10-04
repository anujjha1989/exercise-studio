#!/usr/bin/env bash
# Sets Exercise Studio up as a service on the Raspberry Pi so it starts on boot.
# Run from inside the repo folder:  bash install.sh
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
NODE="$(command -v node)"
PORT="${PORT:-4320}"
sudo tee /etc/systemd/system/exercise-studio.service >/dev/null <<UNIT
[Unit]
Description=Exercise Studio
After=network.target

[Service]
User=$USER
WorkingDirectory=$DIR
Environment=PORT=$PORT
ExecStart=$NODE $DIR/server.js
Restart=on-failure

[Install]
WantedBy=multi-user.target
UNIT
sudo systemctl daemon-reload
sudo systemctl enable --now exercise-studio
sleep 1
systemctl --no-pager --lines=3 status exercise-studio || true
echo "Open http://$(hostname).local:$PORT/"
