# Apple design refinement

Baseline: `23e922e` on main (merged native enhancements and timed-hold review correction).

Implemented: smoother torso/limb landmarks with fewer surfaces, larger isometric framing and adaptive canvas; three visible demo controls with secondary options in a menu; persistent workout/rest/navigation controls and compact prefilled set entry; semantic iOS backgrounds and system-managed bars; Progress summary with separate body weight, measurement, photo, and full-record destinations; Settings destinations preserving all existing actions; TV viewing hierarchy, safe margins, focused form guidance and stepped pairing copy; named muscles, accessible labels, adaptive demo controls, expandable demo height.

Validation: 28 web regression tests and source checks pass. iOS and tvOS simulator builds passed before the final control-layout changes. Encrypted transport passes initial/40 successive updates/pause/wrong-code rejection. Final native unit/UI run started; local simulator is still migrating at boot, so no rendered-app verification yet. Live Pi and physical devices unchanged.

Checkpoint: finish current native builds/tests, inspect available light/dark screenshots, submit PR with explicit verification limits. Do not merge or claim device validation from builds alone.
