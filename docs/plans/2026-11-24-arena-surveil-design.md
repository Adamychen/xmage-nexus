# Arena surveil and scry: one screen, answered by drag — design

## Intent
In-game prompts stop being dialogs and become Arena-style full-screen overlays, with cards the player
drags in 3D (north star: one Arena layout, game UI as close to Arena as possible). Surveil and scry
come first, as the pilot: it is where dragging shows best, and it forces the hard part, which is that
XMage asks one Arena decision as a chain of prompts. The look and feel were agreed on the gallery
mockup (`web/src/dev/ArenaSurveilMock.tsx`, `#/gallery` → "Arena prompts (mockup)", commit
`b7263bc50e`); this design makes it real.

## Goals
- A surveil or scry of your own opens one overlay: the graveyard (surveil) or bottom-of-library (scry)
  box on the left, the library box in the middle, the source card on the right, Done under the library.
- The player decides everything there, by position: which box each card is in, and the order inside
  each box. Done answers the whole chain of server prompts without showing any of them.
- It looks and behaves like the mockup: both boxes fan on the zone viewer's arc (`board/zoneFan.ts`);
  hover lifts a non-interactive clone so a sweep lifts every card in turn; a dragged card stays under
  the pointer and only its tilt follows the speed; a drop places the card at once, a click flies it
  to the other box; View Battlefield (held) and Alt (DLG-5) show the board.
- Fix on the way: the library-order detector (`game/feedback/detect.ts`) recognises "last one chosen
  will be bottommost" as well as "topmost"; today the scry bottom-order prompt falls through to a
  generic target picker.

## Non-goals
- Other prompts (mulligan, trigger order, library search, piles, modes, yes/no). They reuse what this
  builds (overlay shell, fan, drag) in later designs.
- Other effects that order the library one pick at a time (Ponder, Brainstorm-like): same order chain,
  later.
- Any change to the proxy, the protocol or the fork.

## Anti-goals
- Guessing. If a prompt arrives that the plan did not expect, the client never answers it for the
  player; it shows that prompt normally.
- Any of the intermediate prompts flashing on screen while the chain runs.
- A second surveil/scry UI kept alive beside the new one (the old `CardGrid` + `LibraryOrderDialog`
  path for these prompts goes away, apart from the fallback above).

## How the engine asks (fork `PlayerImpl.java`, `HumanPlayer.chooseTarget`)
- **Surveil N** (`doSurveil`): a `GAME_TARGET` over the top N cards, "card(s) to PUT into your
  GRAVEYARD (Surveil)", min 0, max N. Picks are one round trip each (a card UUID); a pick of a picked
  card un-picks it; Done is the non-UUID answer `CardGrid` already sends. The engine may auto-pick
  (`tryToAutoChoose`) and skip a round trip.
  - Two or more to the graveyard, and the user data's `askMoveToGraveOrder` on: a yes/no "Choose the
    order in which the cards go to the graveyard?", then one pick per card but the last, "card to put
    on the top of your graveyard (last one chosen will be topmost)". Only reachable with that
    preference on: `Mage.Proxy` always sends `UserData.getDefaultUserDataView()`, where it is off, so
    through this proxy a surveil never asks it and the plan settles at its last pick answer.
  - Two or more left on top: one pick per card but the last, "card ORDER to put on the TOP of your
    library (last one chosen will be topmost)"; the card left over goes on last, so it ends on top.
- **Scry N** (`scry`): the same, with "to PUT on the BOTTOM of your library (Scry)" first, then the
  bottom order "(last one chosen will be bottommost)", then the top order.

## Approaches (chosen: A)
- **A — the client answers the chain from a plan (chosen).** The overlay opens on the first prompt and
  holds the player's arrangement. On Done it becomes a plan; each prompt that arrives is matched
  against the plan and answered from it, one answer per prompt (PRM-17), until the chain ends. Works
  against any server and proxy as they are today.
- B — a composite action in `Mage.Proxy` that answers the chain server-side. Rejected: a protocol
  change, two proxy flavours (stock and XDHS) to keep in step, and the web would still need A's
  fallback for proxies that lack it.
- C — one surveil/scry callback in the fork's engine. Rejected: diverges from upstream, and
  `beta.xmage.today` runs the stock engine.

## Design
- **Detection** (`game/feedback/detect.ts` + `parse.ts`): a `GAME_TARGET` whose message is the
  surveil or scry pick (the "(Surveil)" / "(Scry)" suffix) and whose cards are your library cards is
  flagged `libraryArrange: 'surveil' | 'scry'`. The order picks keep `isLibraryOrderPick`, now for both
  "topmost" and "bottommost", plus the graveyard-order pick and its yes/no.
- **The overlay** (new, shipped: `game/ArenaLibraryPrompt.tsx` + `.css`, design tokens only, strings
  in the locales) replaces `CardGrid` for a flagged prompt. It is built from the mockup, with the
  mockup's pieces that are not surveil-specific (overlay shell, arc fan with hover clone, drag engine)
  in their own modules so the next prompts reuse them. The source card comes from the prompt's
  `sourceName` / source card.
- **Position means order**, so the plan reads straight off the screen:
  - Library box: the card next to the deck back (leftmost) ends on top of the library.
  - Graveyard box: the rightmost card ends on top of the graveyard, as the graveyard viewer shows its
    top card last. *(my call)*
  - Bottom box (scry): the rightmost card ends at the very bottom. *(my call)*
- **The plan** (a small pure module, `game/feedback/libraryPlan.ts`): from the arrangement it yields,
  for each prompt it may meet, the one answer to send, or `null` for "not mine":
  - the surveil/scry pick: the next card of the away box not yet picked, then Done;
  - the graveyard-order yes/no: yes;
  - an order pick: among the cards it offers, the one that must go in first (deepest for the library
    top, then upwards; the reverse rule for the bottom and the graveyard), checked against "last one
    chosen will be topmost/bottommost";
  - anything else, or a pick that offers a card set the plan does not have: `null`.
  It reacts to what arrives rather than counting prompts, since the engine can auto-pick.
- **While it runs**: the overlay stays up with Done showing "sending" and input locked; no
  intermediate prompt is drawn. The chain ends when a prompt arrives that the plan does not answer
  (or none arrives after the last answer); the overlay then closes. A `null` mid-chain or a rejected
  answer drops the plan, and that prompt is shown with the regular UI.
- **Specs**: a new PRM rule, "Surveil and scry are one screen; the client answers the engine's chain
  from it", with the anti-guessing fallback in the rule text. Its tests carry the rule id: unit tests
  of `libraryPlan.ts` (each prompt shape, auto-picks, a foreign prompt mid-chain), a component test of
  the overlay, and an e2e spec on a FakeServer scenario that replays the real chain.
- **Anti-drift**: a `surveil` and a `scry` driver in `scripts/record.mjs` capture the real prompt
  frames from the local server, so the detector and the plan are tested against what the engine
  actually sends; `web/INTERACTION_COVERAGE.md` gets the rows.
- **Gallery**: the mockup entries are replaced by entries that mount the real overlay on fixtures,
  and the mockup files are deleted.

## Left to the builder
- Exact prompt-text matching (case, HTML stripping) against the recorded frames.
- How the overlay hands the plan to the feedback store, and the timeout after the last answer.
- The surveil-vs-scry source glow colour (from the source card's colour) and the remaining Arena
  touches the mockup lacks (the faint watermark behind the overlay).
