# Stage 5 design sources

The four sign SVGs keep the English labels as editable text. The embedded mascot paths come from the approved Stage 4 library. The artwork manifest records the exact masters and capture hashes.

Open `ui-review.html` in a browser for the HUD. Add `?view=menu` for the main menu or `?view=damage&critical` for the low-health study over the native damage vignette. `?view=menu&stress&empty` shows longer English labels and a disabled Load button. These controls demonstrate appearance and focus only.

The previews use Bahnschrift for signs and controls, Georgia for display text, and Arial or the browser's serif as fallbacks. Font files are supplied by the viewing system. Retain localization strings as text when making production assets.
