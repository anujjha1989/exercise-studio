# Exercise Studio

A home workout app for the Raspberry Pi: 25 exercises with animated demos (bodyweight and dumbbells), a daily session built around your goal, set and time logging, and progress tracking.

## Install on the Pi

```bash
git clone https://github.com/anujjha1989/exercise-studio.git ~/exercise-studio
cd ~/exercise-studio
bash install.sh
```

Then open `http://anujrpi.local:4320/` from any phone or laptop on the home network.

The installer registers a service called `exercise-studio` that starts on boot. To use a different port: `PORT=4400 bash install.sh`.

## Update

```bash
cd ~/exercise-studio && bash update.sh
```

## Where things live

| Path | What it is |
| --- | --- |
| `public/index.html` | The whole app (screens, exercise library, animations) |
| `server.js` | Small Node server, no dependencies; serves the app and saves the log |
| `data/state.json` | Your workout log, goals and weigh-ins. Not in git. Copy this file to back up. |

## Run without installing

```bash
node server.js
```

Needs Node 18 or newer.
