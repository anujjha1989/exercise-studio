# Exercise Studio tvOS artwork

Prepared assets only: this repository does not currently contain a tvOS app target.

`Assets.xcassets/Brand Assets.brandassets` includes 400×240 and 800×480 home-screen artwork, a 1280×768 large icon, and standard/wide top-shelf artwork at 1× and 2×. The supplied landscape master is `assets/tvos-icon.png`; regenerate using `python3 scripts/stage-icons.py` with Pillow 11.3.0.

When creating the tvOS target, include this catalog and set `ASSETCATALOG_COMPILER_APPICON_NAME` to `Brand Assets`. The supplied artwork remains flattened on the background layer, with an empty transparent foreground to satisfy Apple’s two-layer catalog requirement; it has no separated parallax artwork. Top-shelf images preserve the full artwork with burgundy side padding.
