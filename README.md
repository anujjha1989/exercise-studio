# Exercise Studio

A home workout app served directly from editable source on your Raspberry Pi. There is no bundle, build directory, or second rendering path.

- 54 exercises, plus custom exercises, with 3D anatomical demos, muscle labels, pause/replay and slow motion
- Weekly plans filtered by experience, dumbbells, chair availability, low-impact preference, exclusions and session length
- Guided workouts with frozen plan targets, pause/resume, rest timers and per-side logging
- Set editing and undo; completed, partial and custom workout status
- Weight averages, measurements, photos, strength trends and personal bests
- Offline app shell and queued saves; explicit conflict resolution across devices
- CSV export, log backup, log + photos archive, daily backup pairs (last 30 snapshots)

## Run or install

Requires Node 18+ and `tar` (included on Raspberry Pi OS).

```sh
npm run check
npm test
node server.js
```

Open `http://anujrpi.local:4320/`. `bash install.sh` registers the system service. For another port, use `PORT=4400 bash install.sh`.

The editable UI is `public/index.html`, `app.css`, `app.js`, `workout.js`, `data.js` and `figure.js`. `workout.js` contains shared rules exercised by Node tests. The server reads those exact files at runtime. Icons, manifest and fonts are release assets in `public/`.

## HTTPS and offline use

The intended phone route is `https://anujrpi.tail549492.ts.net/exercise/`, served through Caddy and Tailscale. `setup-caddy.sh` configures that route on the existing main site. Home-network HTTP does not provide phone offline installation.

Open the HTTPS route while signed in and add it to the home screen. The worker installs a complete versioned shell, including icons and fonts. It never caches API data, progress photos, errors, sign-in redirects or HTML returned for a script. It only removes Exercise Studio caches. New workers wait until all current app tabs close, avoiding a bundle change during a workout. Every release changing a shell asset must change `CACHE` in `public/sw.js`.

Logs use the same existing `exercisestudio.v2` local key; credentials and photos are not copied into it. Pending local saves survive refresh. The server requires the revision read by the client for every profile/day write and deletion. A stale save pauses that resource and offers downloading both versions, using the Pi version, or keeping the device version with confirmation. A further change on the Pi causes another conflict rather than silent overwrite. Restore similarly requires current revisions.

Older app tabs cannot save through the new API without revisions. Keep their pending edits, export them if necessary, and close/reopen the app to install the current shell. HTTP and HTTPS are separate browser origins with separate local queues. A filled device storage warning means edits are still only in memory until a successful server save; keep the page open and download your data.

## Completion and historical records

A workout is complete only when every frozen planned exercise meets its set target. For unilateral exercises both sides must reach the target. Older sets without a side are treated as paired sets. Extra exercises do not substitute for missing prescribed exercises. Ending a zero-set workout cancels it; ending early retains a partial workout. Partial activity remains in history, muscle totals, personal bests and strength trends, but does not satisfy weekly completion goals.

Historical and custom logs without a plan remain intact and are labelled partial until explicitly marked complete in History. Changing setup never rewrites an already logged plan. Future plans use the new settings. Time limits include an estimated warm-up and both sides; actual time depends on pace. Guidance and muscle totals are planning aids, not measured muscle growth or fat loss. Weight charts average only recorded weigh-ins in the prior seven days. Strength charts show measured best sets, not inferred one-rep maximums. Calorie guesses have been removed.

The demos use a source-owned 3D anatomical illustration with isometric, front and side views, red primary muscles and lighter assisting muscles. They are stylized illustrations, not a professional anatomical model or technique certification; follow the accompanying form instructions. No third-party exercise video has been copied. Custom exercises have notes but no generated movement demo.

## Updates and rollback

After this release is installed, use:

```sh
cd ~/exercise-studio
bash update.sh
```

The script refuses dirty checkouts, stages the selected commit outside the live checkout, runs checks/tests, backs up the previous source and data including photos, fast-forwards the canonical checkout, restarts the service and verifies version plus every public asset's MIME and SHA-256 bytes. Failed restart or verification restores the previous source and restarts. User data is retained; this version only adds fields and older source ignores them. The old source and pre-install data archive are also recoverable under `~/exercise-studio-releases/`.

You can pass an explicit commit/ref as the first argument. `CHECK_ORIGIN` can select a reachable origin (trailing slash required); the default verifies the service locally. Authenticated public HTTPS checks are still required in a browser.

For the **first upgrade from the old updater**, use the reviewed new updater from the merged commit before changing the checkout:

```sh
cd ~/exercise-studio
git fetch origin
git show origin/main:update.sh > /tmp/exercise-studio-reviewed-update.sh
EXERCISE_ROOT="$HOME/exercise-studio" bash /tmp/exercise-studio-reviewed-update.sh origin/main
rm /tmp/exercise-studio-reviewed-update.sh
```

After installation, verify the actual `/exercise/` route on a phone over HTTPS: sign-in, light and dark modes, demo playback, partial and complete logging, editing, pause/resume, offline reopening/logging and reconnection. This PR does not deploy or assert those production checks have passed. Local checks cannot substitute for that final release check.

## Data and recovery

| Path | Contents |
| --- | --- |
| `public/` | Canonical UI and release assets |
| `server.js` | Node server; no npm runtime dependencies |
| `data/state.json` | Logs, goals, measurements and revision counters |
| `data/photos/` | Progress photos |
| `data/backups/` | JSON + photo archive pairs captured before the first change of the UTC day; 30 retained |

Setup offers a JSON log backup for in-app restore and a `.tar.gz` archive containing `state.json` and `photos/` for complete recovery. For a complete archive restore, stop the service, preserve the existing data directory, extract the trusted archive into a fresh data directory, replace the original and restart. Close all app tabs and preserve queued local edits before recovery. The archive restores photos; the JSON restore only replaces logs/profile. Daily snapshots and release archives consume additional disk space; no release archive is deleted automatically.

## Validation

`npm run check` parses all source JavaScript. `npm test` covers completion, legacy records, both sides, pause duration, equipment/impact/time filtering, strength and weight trends, concurrent writes/deletes, restore conflicts, nested log validation, photo archives, asset types and offline cache rejection. CI runs both commands plus a shell syntax check. Browser tests use disposable local data; live user data is never a test fixture.

The offline cache name is derived from the app files by `release-stamp.js` when the server starts, so any release that changes a file refreshes the copy on your phone automatically (after the app is fully closed and reopened).

The browser boots through `public/boot.mjs`. The editable renderer and pose mapping are `public/figure.js` and `public/figure-math.js`. Three.js is pinned in `package-lock.json`; reproduce the committed browser modules with `npm ci --ignore-scripts && npm run stage-assets`. CI checks these generated assets against the committed files. Fonts are bundled locally with their OFL licenses, so the offline shell has no external font dependency.
