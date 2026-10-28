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

### SET-4 · The dialog is a side menu of grouped sections, without a footer
The settings dialog has a side menu with a search field and the five sections in two groups:
"Game" (Gameplay, Board) and "App" (Interface, Language, Sound & effects). Each entry shows an
icon and its label, and the open one is marked as the current page (`aria-current="page"`). The
dialog opens at Gameplay, the first entry, unless the caller asks for a section. The content side
starts with the open section's title and a one-line description of what it holds, and the close
button sits next to that title; there is no "Settings" chip above it and no footer: "Review setup"
is the last entry of the side menu.

- Why: the text-only menu, the chip and the large title repeated the same word three times and
  spent about 90 px of height, and a fixed footer held a single link (the review of 2026-10-26).
- Guard: `src/settings/SettingsModal.test.tsx` · `e2e/settings.spec.ts`

### SET-5 · Every section lays its settings out as titled groups of rows
Each section shows its settings in titled groups. A group is one card of rows; a row has the label
and its explanation on the left and the control on the right (a switch, a slider with its value, a
select, or a segmented choice), and the same row style is used by every section, the sound
controls included. A disabled row dims its label and its explanation together, so the explanation
of why it is disabled is never brighter than the label. A choice with a fixed set of options
(theme, interface size, animation speed, priority cue) is one segmented control, not a grid of
buttons with empty columns.

- Why: Sound, Gameplay and Interface each had their own row style; hints were nearly the same tone
  as labels, so Gameplay read as a wall of text; Appearance put three choices in a five-column grid;
  and the interface size had a full-width stepper plus five buttons doing the same thing.
- Guard: `src/settings/SettingsModal.test.tsx` · `e2e/settings.spec.ts`

### SET-6 · Search finds any setting by its label or its explanation
Typing in the side menu's search field replaces the section with the settings whose label or
explanation contains the text, ignoring case and accents. Each result shows the label, the
explanation and where the setting lives ("Section › Group"), and its "Go" button opens that section
(and, for the board, its tab), clears the search, scrolls the setting into view and highlights it
briefly. When nothing matches, the dialog says so. Every searchable setting resolves to a row on
screen: the search index and the rows cannot drift apart.

- Why: with about 45 settings in five sections, finding "summoning sickness" or "rewind" meant
  guessing the section and scrolling (the review of 2026-10-26).
- Guard: `src/settings/SettingsModal.test.tsx` · `src/settings/settingsIndex.test.tsx` · `e2e/settings.spec.ts`

### SET-7 · The board section has tabs and a live preview
The Board section is split into four tabs: Layout, Cards, Overlays, and Table & sleeves. Next to the
tab's settings a preview shows your own battlefield and hand drawn by the real board card
(`CardSlot`) with your current choices: card style, tapped style, P/T badge, summoning sickness,
keyword icons and effects, mana sources, hand costs and playmat; it changes as soon as a choice
does. On the Layout tab the preview is the miniature of the current layout. A picker grid has as
many columns as it has options, so no row is left with an orphan or an empty column, and every
picker marks its selection the same way (brand border and check), the playmats included. An on/off
option is a switch row with a small miniature of its current state, not two cards.

- Why: the section was one 4 000 px scroll (almost 10 000 px on a phone) of thirteen pickers, the
  three-column grids left holes, and the on/off miniatures were nearly identical (2026-10-26).
- Guard: `src/settings/BoardLivePreview.test.tsx` · `src/settings/SettingsModal.test.tsx` · `e2e/picker-demos.spec.ts` · `e2e/settings.spec.ts`

### SET-8 · Default phase stops are a labelled table and auto-answers explain themselves
The default phase stops are a table with a row for your turn and one for the opponent's, and a
column per step headed by its short code and its name (Upkeep, Draw, Main 1…). With no
auto-answers saved, the group explains how to create one: by ticking "Always answer like this" when a
yes/no question offers it.

- Why: the stops were 26 px buttons with bare two-letter codes, and the empty state only said
  "no rules" (2026-10-26).
- Guard: `src/settings/SettingsModal.test.tsx`

### SET-9 · On a phone the dialog is a full-screen list that opens each section
At a window width of 560 px or less the dialog fills the screen. It opens on the list of sections,
each with its icon and, where it has one, its current value (the gameplay preset, the board
layout, the theme and size, the language). Choosing a section shows only that section, with a back
button to the list; the caller's requested section, when there is one, opens directly.

- Why: on a 390 × 844 phone the wrapped two-row menu, the header and the footer left 397 px for the
  settings (2026-10-26).
- Guard: `src/settings/SettingsModal.test.tsx` · `e2e/settings.spec.ts`

### SET-10 · The example cards in the settings are silent and never fly
The example cards that the Board section draws with the real board card (`CardSlot` with `demo`:
the option miniatures of `BoardDemo` and the live preview) are decoration. They never start the
enter or move flight a game card gets, never play its sound and never record a position for the
next card with the same id. Switching between Board tabs plays only the button click.

- Why: the Cards and Overlays tabs draw miniatures with the same ids (`demo-<name>`); switching
  between them, or coming back to them, made `CardSlot` treat each miniature as a card that moved,
  so a flight started and `play_card` sounded on top of the click (report of 2026-10-28).
- Guard: `src/board/CardSlot.flight.test.tsx`
