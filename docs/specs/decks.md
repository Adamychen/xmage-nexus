# Decks

Prefix: `DCK`

The deck screens: the gallery (`web/src/decks/DecksGallery.tsx`), the deck builder
(`DeckBuilder.tsx`, its card pool grid and filter bar `ArenaFilterBar.tsx`) and the stacks view
(`DeckStacksEditor.tsx`, which draws the deck as Arena-style type columns with
`ArenaCardStacks.tsx`).

### DCK-1 · The stacks view has a card size slider up to 200%
The stacks view has a "Card size" slider in its header, the same control the deck builder shows in
its filter bar (label, range input, value as a percentage). It goes from 50% to 200% in steps of
10%, 100% by default (today's tile size). It scales the cards of the main deck columns: tile width,
the peek height of each stacked card and the column width grow and shrink together, so a stack
stays readable at every size. The sideboard column keeps its size. When the columns no longer fit,
the main area scrolls (both directions as needed) inside itself; the page never scrolls sideways and
the search panel and sideboard keep their place. Clicking, Shift-clicking and the copy-count badge
behave the same at every size. The value (`deckStacksScale`) is a player setting kept across
sessions.

- Why: at the default size a 60-card deck's columns are small to read on a large screen, and the
  deck builder already let players choose a card size; the user asked for the same in the stacks
  view, up to 200% (2026-10-24).
- Guard: `src/decks/DeckStacksEditor.test.tsx` · `src/state/persistence.test.ts` · `e2e/stacks-editor.spec.ts`

### DCK-2 · Picking a deck file imports it and clears the picker, so the same file can be picked again
Importing a deck or restoring a backup from a file picker reads the file, applies it, and then
empties the picker. The picker is emptied even when the read fails, and the same file can be picked
again straight after. A failed read never surfaces as an unhandled error.

- Why: the report of 22 Oct 2026 (app 0.5.0): the handler read the input's `currentTarget` after
  `await`, when React has already cleared it, so every pick threw `TypeError: Cannot set properties
  of null` and the picker kept its value.
- Guard: `src/decks/DeckImportModal.test.tsx` · `src/decks/ImportDeckDialog.test.tsx` · `src/decks/DecksGallery.test.tsx`

### DCK-3 · The hover preview shows the whole card, the same in every deck screen
Hovering a card in the deck builder, the construct screen, the draft or the sideboard shows one
enlarged preview (`DeckHoverPreview`): the whole card, never cropped, up to 420 px wide and never
wider than half the window or taller than the window, with both faces side by side for a
double-faced card. It opens beside the hovered card, on the side with room, and stays inside the
window. Its styles live only in `DeckHoverPreview.css`.

- Why: each screen kept its own copy of the preview markup and of the global
  `.arena-floating-preview` rules. When the deck builder preview grew to 420 px (`a594f15186`),
  the draft screen's `img { max-width: 255px }` still applied, so every deck builder preview showed
  a 255 px strip of the card cropped by `object-fit: cover` inside a 420 px frame. The position also
  assumed a 255 px preview, so the larger one could cover the hovered card or leave the window.
- Guard: `src/decks/DeckHoverPreview.test.tsx` · `src/decks/hoverPreviewCss.test.ts`

### DCK-4 · On a touch screen the deck strip actions are always shown
Each card in the deck strip has its actions (move, add, remove, print, favourite, commander) shown without
a hover on a screen that has no hover. On a pointer device they stay hidden until hover or keyboard focus,
as before.

- Why: the actions only appeared on hover or focus-within, so a phone player could not reach them (the
  review of 2026-10-25). Offering an alternative to a hover gesture is the rule in ACC-9.
- Guard: `e2e/decks-touch.spec.ts`
