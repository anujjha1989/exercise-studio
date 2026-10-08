# Exercise Studio for iPhone

The workout interface is native SwiftUI: Today, Library, History, Progress, Setup, guided sessions, per-side logging/edit/undo, charts, Photos picker, backup sharing and restore confirmation. SceneKit renders exercise poses natively, with isometric/front/side views, muscle highlights and playback controls. The only WKWebView is the Pi's existing passphrase sign-in page, dismissed once native API access succeeds. No workout HTML is loaded.

Canonical data and rules remain in `public/data.js`, `public/workout.js`, `public/figure-math.js` and the profile/planning functions in `public/app.js`. `node scripts/stage-ios.js` generates `Resources/shared-rules.js`; JavaScriptCore executes those pure rules without a DOM, so exercise definitions, frozen plans, completion, equipment filters and trends stay aligned. This generated resource is committed for offline builds; CI verifies reproducibility. The native anatomy mesh is a separate SceneKit renderer using the shared joint poses, not the detailed Three.js web model. Both are stylized illustrations.

The default server is `https://anujrpi.tail549492.ts.net/exercise/`. Keep Tailscale enabled and the Pi running for sync. Sign-in cookies are copied from the app's persistent WebKit session into URLSession; credentials are never embedded. Native files use iOS data protection and separate per-origin caches. Unknown profile/day fields are preserved. Pending edits survive reopening; If-Match writes and explicit conflict resolution prevent silent replacement. No routine successful-save label appears. Offline, storage and conflict notices appear only when relevant.

The previous wrapper's web localStorage remains in the app container and is not automatically imported. Reconcile any unsaved wrapper edits before moving to the native version. Saved Pi records are fetched normally. Native exports can preserve queued local records. Uninstall removes local queues and sessions; it does not delete Pi records.

Guided workouts preserve their frozen plan and resume paused after app termination. Leaving the active app pauses the session; iOS background execution is not requested. Keep-awake is optional in Setup. Progress photos require a connection; the bundled library and native cached records are available offline. Photo archives remain server-generated.

## Build and install

Open `ExerciseStudio.xcodeproj`, choose ExerciseStudio and your iPhone, then Run. Automatic signing uses Anuj Jha's paid team `4YQ5449J68`. iOS 17+; no external native packages. `project.yml` is canonical project configuration; regenerate with `xcodegen generate --spec ios/project.yml` from repository root. Build products/signing profiles stay outside source control. The orange weightlifting icon is generated from the current web icon at 1024px.

Rebuild shared resources after exercise/rule changes with `node scripts/stage-ios.js`, then verify the generated diff. Never hand-edit generated rules or duplicate a workout implementation in HTML.

## Verification

Unit tests cover all 54 exercise definitions and finite poses, frozen targets, both sides, filtering, durable local data, and revision-checked conflict/save behavior. UI tests use offline simulator data to check native library/search/demo controls and absence of workout web views. No test writes user workout data. The real HTTPS sign-in/records and device installation need a separate physical-phone check.

Before relying on a release, check both themes, demo motion, scheduled/custom logging, edit/undo, partial/complete history, pause/resume, relaunch, offline queued logging/reconnection, conflict handling, photos, CSV/JSON/archive sharing and restore confirmation on the intended iPhone. No Pi deployment is needed for the native app. The Pi remains the API/data server. Public App Store release is outside this personal-use scope.
