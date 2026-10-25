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
