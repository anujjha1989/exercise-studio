# Apple design refinement

Baseline: `23e922e` on main (merged native enhancements and timed-hold review correction).

Implemented: smoother torso/limb landmarks with fewer surfaces, larger isometric framing and adaptive canvas; three visible demo controls with secondary options in a menu; persistent workout/rest/navigation controls and compact prefilled set entry; semantic iOS backgrounds and system-managed bars; Progress summary with separate body weight, measurement, photo, and full-record destinations; Settings destinations preserving all existing actions; TV viewing hierarchy, safe margins, focused form guidance and stepped pairing copy; named muscles, accessible labels, adaptive demo controls, expandable demo height.

Validation: 28 web regression tests and source checks pass. iOS and tvOS simulator builds passed before the final control-layout changes. Encrypted transport passes initial/40 successive updates/pause/wrong-code rejection. Final native unit/UI run started; local simulator is still migrating at boot, so no rendered-app verification yet. Live Pi and physical devices unchanged.

Checkpoint: finish current native builds/tests, inspect available light/dark screenshots, submit PR with explicit verification limits. Do not merge or claim device validation from builds alone.

## Resume checkpoint — 21 October

Final application source: `ad5dcbe` (the following documentation commit does not alter application code).
- Latest iOS simulator build passes (`../design-resume-build.log`); tvOS build passes (`../design-tv-final.log`).
- Earlier local native run: 15 unit tests + 3 UI tests passed. Hosted run on `039590c`: builds, native unit tests and first three UI tests passed; fourth UI test incorrectly asserted absence of the underlying camera button retained behind a sheet. Corrected to assert that it is not interactive, and that the logging action is interactive.
- Inspected actual exported screenshots: light exercise demo, compact set entry, accessibility text layout. Inspected tvOS simulator connection screen. The previously named dark screenshot was actually light; added an offline-debug-only deterministic appearance hook. Corrected dark screenshot still needs inspection.
- Hosted final native rerun is queued (run 39626083755 as last checked). Local test runner stalled before tests, and simulator shutdown stalled on recovery. Cancelled the retry shell; no simulator reset or changes to other apps/devices.
- PR #6 remains draft. Remaining release checkpoint: final native test pass, corrected dark screenshot, active TV screen and physical pairing verification. No source merge, Pi deployment, or physical installation performed.
