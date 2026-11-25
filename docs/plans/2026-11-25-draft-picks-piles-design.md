# Draft picks as Arena piles — design

## Intent

During a draft the player's picks are a flat grid of 90 px thumbnails inside a 260 px scrolling band
(`web/src/game/DraftScreen.tsx`, `.draft-picks-grid`). The user: "the cards don't read well, it looks
like Excel with the grid, not the 3D look". They want the picks to look like the deck editor's Piles
view (`ArenaCardStacks`): overlapping cards in columns, lifted on hover, two zones, drag between them.

## Goals

- The picks band draws the pool with `ArenaCardStacks`: a **Deck** zone grouped by mana value
  (0–5, 6+, lands in their own last pile, via `buildStackColumns` with `group: 'cmc'`) and a
  **Sideboard** band under it.
- Moving a pick to the Sideboard is the existing "hide pick" (`hiddenIds`, sent with every
  `sendCardPick`); moving it back un-hides it. This matches the server: `DraftPlayer.prepareDeck`
  moves every non-hidden pick to the main deck and keeps the hidden ones in the sideboard when
  construction starts.
- Moving works by drag, Shift+click and the `S` key (the stacks' existing swap gesture).
- Hover shows the existing `DeckHoverPreview` (the draft has no card panel).
- Kept: the fly-to-picks animation lands on the new card in its pile; the "new" mark on the last
  pick; right-click on the band / F9 shows all hidden (moves them back to Deck).

## Non-goals

- The Construction screen, a full-screen draft, the booster grid, the pick helper.
- Free piles, rarity/colour grouping, a card-size slider in the draft.

## Anti-goals

- A fixed pixel height that fits one machine's cards (AGENTS.md "pixel budget" rule): the band
  grows to fit the piles from a runtime measure or the stacks' own scale, and the spec asserts
  the contract (no pile clipped / band scrolls instead of clipping), not a number.
- Losing a pick's hidden state on reload: hidden ids stay as they are today.

## Approaches considered

- **A.** Piles in the draft and in Construction — one component for both screens. Not chosen now.
- **B.** A, with Construction opening the full deck editor — most features, most risk. Not chosen.
- **C. (chosen by the user)** Only the draft picks band.

## Left to the builder

- Adapting `SimpleCardView` + the draft's `metaMap` to the `DeckCard`/`CardStripMeta` shape
  `buildStackColumns` expects (one `DeckCard` per pick, amount 1, keyed by card id so the hide set
  maps 1:1).
- The band's height policy and the stacks' scale in the draft.
- Test ids: keep `draft-picks` / `draft-pick-card` reachable (e2e and `flyCardTo` landing use them).
- A new rule in `docs/specs/tournaments.md` (TRN-21) with tests titled after it.
