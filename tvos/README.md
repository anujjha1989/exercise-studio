# Exercise Studio for Apple TV

A native SwiftUI workout display with the shared SceneKit anatomy renderer and bundled exercise library. The phone remains responsible for logging and saving to the Pi. The TV never receives photos, profile, history or server credentials.

## Build

Run `node scripts/stage-ios.js`, then `xcodegen generate --spec ios/project.yml` and `xcodegen generate --spec tvos/project.yml`. Open `ExerciseStudioTV.xcodeproj`, select ExerciseStudioTV and your Apple TV, and Run. Personal signing uses the same paid Apple team as the phone. tvOS 17+; no third-party native packages.

## Pair and exercise

On the same local network, start a workout on the iPhone and tap **Show workout on Apple TV**. Enter its temporary 12-character code in the TV app. Allow Local Network access on each device when prompted. Live exercise, paired set progress, pause and rest status update once a second. Use the phone to log, skip rest, change exercise, pause and end. TV demos stop when the phone pauses or updates stop for eight seconds. Ending/disconnecting clears the session; codes change each time TV mode starts.

The connection is direct Bonjour/TCP with AES-GCM authenticated encryption using a temporary random 60-bit pairing secret. Pairing attempts time out after ten seconds and the host stops after five incorrect codes. One TV can connect at a time. An intercepted code grants access to this session display until disconnected, so keep it private. This is local-network mode, not an Internet or Tailscale relay.

## Icons

`Assets.xcassets/Brand Assets.brandassets` is generated from the supplied `assets/tvos-icon.png` by `python3 scripts/stage-icons.py` with Pillow 11.3.0. It includes small/large icons and standard/wide top-shelf artwork. The original artwork remains flattened with a transparent second layer for Apple's catalog requirements.

## Verification

CI builds the TV app and compiles the icon catalog. Native loopback tests verify encrypted updates and wrong-code rejection. Simulator and physical-device checks must cover Bonjour discovery, permission prompts, pairing, phone backgrounding, rest/pause/end and disconnect. The offline TV library is available without a phone. It does not independently log workouts.
