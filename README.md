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

## HTTPS over Tailscale (needed for offline use)

The app can only keep an offline copy on your phone when it is opened over HTTPS. Tailscale provides that:

```bash
tailscale serve --bg --https=8446 http://127.0.0.1:4320
```

Then open `https://anujrpi.tail549492.ts.net:8446/` from any device signed in to your tailnet. This is tailnet-only (not Funnel) and survives reboots. To turn it off: `tailscale serve --https=8446 off`.

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
