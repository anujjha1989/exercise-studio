# Exercise Studio

A home workout app for the Raspberry Pi.

- 54 exercises (bodyweight and dumbbells) with animated pictogram demos, muscle highlighting and slow motion, plus your own custom exercises
- A weekly programme built from your goal, training days and focus areas
- Guided workout mode with rest timer, and suggestions for when to add reps or weight
- Logging for sets, time, body weight, measurements and progress photos
- Progress page: weekly verdict, 12-week calendar, sets per body area, personal bests
- CSV export, daily backups, restore, and offline logging that syncs when the Pi is back

## Install on the Pi

```bash
git clone https://github.com/anujjha1989/exercise-studio.git ~/exercise-studio
cd ~/exercise-studio
bash install.sh
```

Then open `http://anujrpi.local:4320/` from any phone or laptop on the home network.

The installer registers a service called `exercise-studio` that starts on boot. To use a different port: `PORT=4400 bash install.sh`.

## HTTPS over Tailscale and Caddy (needed for offline use)

The app can only keep an offline copy on your phone when it is opened over HTTPS. On the Pi it is served as `/exercise/` on the main Caddy site, which Tailscale already exposes over HTTPS:

```bash
sudo bash setup-caddy.sh
```

Then open `https://anujrpi.tail549492.ts.net/exercise/` from any device signed in to your tailnet (or `http://anujrpi.local:8090/exercise/` at home). The script backs up the Caddyfile to `/etc/caddy/Caddyfile.backup-before-exercise` first.

## Update

```bash
cd ~/exercise-studio && bash update.sh
```

## Where things live

| Path | What it is |
| --- | --- |
| `public/` | The app: `index.html`, `app.css`, `app.js`, `data.js` (exercise library), `figure.js` (animations) |
| `server.js` | Small Node server, no dependencies; serves the app and saves your data |
| `data/state.json` | Workout log, goals, weigh-ins and measurements. Not in git. |
| `data/photos/` | Progress photos. Not in git. |
| `data/backups/` | One copy of `state.json` per day, last 30 kept. Not in git. |

## Run without installing

```bash
node server.js
```

Needs Node 18 or newer.
