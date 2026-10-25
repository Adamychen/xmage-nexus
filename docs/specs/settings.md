# Settings

Prefix: `SET`

The settings dialog (`web/src/settings/SettingsModal.tsx`, sections in `sections.tsx`) and the
player settings it writes (`web/src/state/` settings slice, persisted by `persistence.ts`). Board
layout choices that already have their own rule live with that rule (for example the main board
panel width, BRD-13); this file holds the settings that are not owned by another area.

### SET-1 · The in-game card preview size is a player setting
The Interface section of the settings dialog (the general section, next to the interface scale)
has a "Card preview size" slider for the enlarged card shown while hovering or inspecting a card
during a game (`FloatingCardPreview`, used by the board, hand, stack, piles, log and dialogs). It
goes from 75% to 200% in steps of 5%, 100% by default (today's 320 × 448 px card), shows its
current value as a percentage, and has a reset to 100%. The setting (`cardPreviewScale`) is kept
across games and reloads, and a change applies to the next preview without restarting the game.
The card image and its rules/keyword side panel scale together. A preview never leaves the visible
board: when the chosen size does not fit the space available, it shrinks to the largest size that
fits instead of being clipped, and the placement (left/right of the card, flipping at the edge)
keeps working at every size. On the game board the interface scale (`uiScale`) does not change
the preview, because the game screen cancels it; this slider is the only size control there.

- Why: on large or high-density screens the fixed 320 px preview was too small to read, and on
  small ones too big; the user asked for a size parameter in the general settings (2026-10-24).
- Guard: `src/board/FloatingCardPreview.test.tsx` · `src/settings/SettingsModal.test.tsx` · `src/state/persistence.test.ts` · `e2e/card-preview-size.spec.ts`

### SET-2 · The turn recap strip is opt-in
The "Since your last turn" / "<player>'s turn" recap strip (`TurnRecapStrip`) at the top of the
board is off by default. The Gameplay section of the settings dialog has a "Show the turn recap"
toggle; the choice (`turnRecap`, stored under `mage-web-turn-recap`) is kept across games and
reloads. While it is off the strip never mounts. The recap is still computed, so the "New" /
"Changed" marks on permanents keep working either way. The small "Last actions" box is not
affected by this setting.

- Why: the strip covers the middle of the board at the start of every turn, and the user found it
  more intrusive than useful; it stays available for players who want it (2026-10-24).
- Guard: `src/settings/SettingsModal.test.tsx` · `src/state/persistence.test.ts` · `e2e/game-assist.spec.ts`

### SET-3 · A setting's explanation is visible text, not only a tooltip
A setting that needs an explanation shows it as a line of text under its label. The explanation is
readable by touch, by keyboard and by screen readers, and it does not depend on hovering. A disabled
setting shows the reason as visible text too.

- Why: the hints were only `title` tooltips, so a touch or keyboard player never saw them (the review of
  2026-10-25). Apple's writing guidance asks for an explanation when the label is not enough.
- Guard: `src/settings/SettingsModal.test.tsx`
