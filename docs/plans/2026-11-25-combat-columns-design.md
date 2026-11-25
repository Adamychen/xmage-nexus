# Combat read by position: columns instead of arrows — design

## Intent
Combat is the one place where the board still asks the player to trace lines. Every attacker draws an
arrow to its defender and every blocker draws one back to its attacker, so a multiple block crosses
the table four or five times and the blocker's curve loops over half the board. The mockup
(`#/gallery` → the combat-reading study of 2026-11-24, five arrangements of the same combat)
settled the answer: **who fights whom is read by position, the way MTG Arena reads it**, and the only
line left is the damage that actually lands.

## Goals
- During combat each seat's creatures arrange into **combat columns**: the attacker steps forward and
  its blockers stand in front of it, fanned when there are several. A block draws no line at all.
- Columns are **grouped by defender**, so a pod reads "these three are coming at me" as a block of
  columns, not as a bundle of crossing curves.
- The only arrows left are the **unblocked attackers**, braided into one beam per defender that ends
  on that defender (a seat's avatar, a planeswalker or a battle), because that is the damage the
  defender is about to take.
- With the side panel open **nothing crosses the panel**: a beam that would leave the board ends in a
  dock against the board's edge, at the height of the seat it goes to, and that seat's head lights in
  its colour with the damage it is taking.
- Creatures not in combat stay where they are, dimmed, so the eye reads the engaged ones first.
- The whole combat is also written in the side drawer, as a **Combat tab**: one block per defender
  with its damage, and inside it a line per attacker saying who blocks it. Hovering a line lights that
  group on the board. The drawer is a complement, never the only way to read combat.

## Non-goals
- Declaring attackers and blockers: the picking (CMB-1), the bar (CMB-2) and the windows (CMB-11,
  CMB-12) stay exactly as they are. This design changes how a declared combat is **read**.
- Damage assignment order (CMB-8) and the strike animations (FX of `combatStrikes.ts`), which keep
  working on whatever position the cards end up in.
- The proxy, the protocol and the fork: everything here is read from `game.combat`, which the client
  already receives.

## Anti-goals
- Guessing who blocks whom. The pairing comes from the server's combat groups; a group the client
  cannot place keeps today's arrow rather than inventing a column.
- A board that keeps re-arranging. The arrangement is one layout pass, settled (BRD-21), and it is
  undone when combat ends.
- Cards that cannot be clicked where they stand: a creature in a column is still the same slot, with
  its hover, its preview and its selection.

## How the engine describes a combat
`GameView.combat` is a list of `CombatGroupView`, one per attacking group:

| Field | Meaning |
|---|---|
| `attackers` | the creatures attacking in that group (a band attacks as one group) |
| `blockers` | the creatures blocking that group |
| `defenders` | who the group attacks: a player id, or a planeswalker/battle card id |
| `attacker` | the group's first attacker, as the engine writes it |
| `isAttackedByDefender` | the group attacks a permanent of a defender, not the player |

Today `combatActorsFrom` (`state/gameUtils.ts`) flattens that into two id lists, which is all the
marks and the arrows need. The columns need the grouping itself, so the model keeps it.

## The arrangement
Per seat, the creatures row is read as two bands while combat is live:

- **Engaged**, in front: one column per combat group, ordered by defender. A column is the attacker
  (or the band) with its blockers in front of it; several blockers fan, the way a hand fans, so each
  one is still clickable.
- **At ease**, behind: everything else, dimmed, in the order it already had.

The columns of one defender sit together, and the block of columns leans toward that defender: the
defender's own column block is the one under their seat, and in a pod the blocks are ordered as the
seats are. A seat with nothing engaged keeps its row untouched.

When combat ends (the view carries no groups), the row returns to its normal arrangement in one pass.

## What it costs
The positions are computed, not painted: the arrangement runs inside the board's layout solver
(BRD-25), which already owns where every card sits, and the FLIP of a tap (FX-16) is what slides the
cards into their columns. That is the expensive part of this design and the reason the mockup
ranked it "high cost": the solver gains a mode, and the settle guards (BRD-21,
`e2e/board-settle.spec.ts`) have to stay green with it.

## Risks
- **Oscillation.** A band that re-fits because a card moved, which moves a card, is the failure the
  settle guards exist for. The arrangement is derived from the view, never from measurements, so a
  column's existence cannot depend on the width it produces.
- **Room.** A four-player board with a wide combat can run out of width; the solver already shrinks
  cards to fit and the columns inherit that, with the blockers' fan closing up first.
- **The panel.** A copy in the panel is a miniature of the main area, so it arranges the same way at
  its own scale; the dock and the seat mark are what replace the beams that used to cross it.

## Phases
1. **Model.** `board/combatColumns.ts`: from `game.combat` and the battlefield, the columns per seat
   and per defender, the unblocked attackers per defender and the creatures at ease. Pure, unit
   tested, with the recorded pod frame (`fixtures/recorded/pod-combat.json`) as a fixture.
2. **Arrangement.** The solver and the creatures row draw the columns; gallery entries for a
   skirmish, a wide attack, a multiple block and a four-player table.
3. **Arrows.** One beam per defender for the unblocked attackers, blocker arrows gone (CMB-4
   rewritten), the dock and the seat mark with the panel open.
4. **Drawer.** The Combat tab, hover-linked to the board.

Each phase ships on its own: 1 is invisible, 2 is the change, 3 removes what 2 makes redundant, 4 is
the complement. Nothing between phases leaves combat unreadable: the arrows stay until the columns
can replace them.
