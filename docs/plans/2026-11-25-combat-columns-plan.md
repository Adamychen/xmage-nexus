# Combat columns implementation plan

**Goal:** a declared combat is read by position: columns of attacker + blockers per combat group,
grouped by defender, with one beam per defender for the damage that lands and no blocker arrows at all.

**Spec:** `docs/plans/2026-11-25-combat-columns-design.md`. Mockup: the combat-reading study of
2026-11-24 (five arrangements of the same combat).

**Architecture:** a pure model turns `game.combat` into columns per seat; the board's layout solver
(BRD-25) gains a combat arrangement that the creatures row renders; the arrows overlay drops to one
beam per defender; the drawer gains a Combat tab fed by the same model.

## Global constraints
- English only in code, tests and docs; user strings through `web/src/i18n/locales/*` (all nine).
- No comments in code unless asked; CSS uses `web/src/ui/tokens.css` tokens only.
- The pairing comes from the server's groups; a group the client cannot place keeps its arrow.
- Every phase keeps `e2e/board-settle.spec.ts` and `e2e/board-spotlight-settle.spec.ts` green: the
  arrangement is derived from the view, never from a measurement it produces.
- After touching `web/`: `npm run test`, `npm run typecheck`, plus the combat specs by name
  (`combat`, `combat-human`, `combat-multiblock`, `combat-undeclare`, `arena-board`, `spotlight`).
- Commit per task; push and deploy only when the user asks.

## Task 1 — The model (invisible)
- [ ] `web/src/board/combatColumns.ts`: `combatColumns(game)` → per defender
      `{ defenderId, kind: 'player' | 'permanent', columns: [{ attackerIds, blockerIds }], unblocked: attackerIds[] }`,
      plus `atEaseIds` per seat. Reads `attackers`/`blockers`/`defenders` and keeps a group whose
      defender it cannot resolve in a `strays` list.
- [ ] `combatColumns.test.ts`: a skirmish (one attacker, one blocker), a wide attack (several
      attackers, no blockers), a multiple block (one attacker, three blockers), a band
      (two attackers in one group), a pod (three defenders), a group attacking a planeswalker, and
      the recorded `fixtures/recorded/pod-combat.json`.
- [ ] Gallery: the four scenarios of the mockup as entries, so phase 2 has something to look at.

## Task 2 — The arrangement (the change)
- [ ] The creatures row of a seat renders the columns when the model has any: engaged in front,
      at ease behind and dimmed, blockers fanned in front of their attacker.
- [ ] The solver sizes a column as its widest member and the fan closes up before the cards shrink.
- [ ] The columns of one defender sit together and the blocks follow the seat order.
- [ ] Leaving combat returns the row in one pass; `BRD-21` settle guards green, with a new e2e that
      declares a combat and asserts the board settles with it.
- [ ] Spec: new `CMB-14 · A declared combat is read by position`, with the arrangement rules.

## Task 3 — The arrows
- [ ] One beam per defender for the unblocked attackers (braided), blocker arrows removed.
- [ ] With the panel open the beam ends in a dock at the board's edge, at the height of the seat, and
      the seat's head lights in its colour with the damage it is taking.
- [ ] Spec: `CMB-4` rewritten (one beam per defender, no blocker arrows, the dock), its guard
      extended in `CombatArrowsOverlay.test.tsx`.

## Task 4 — The drawer
- [ ] A Combat tab beside the log and the deck: one block per defender with its damage, a line per
      attacker with who blocks it; hovering a line lights that group on the board.
- [ ] Spec: `PNL-12 · The drawer tells the whole combat`, guard in the panel tests.

## Review focus
- A **band** (two attackers in one group) is one column, not two.
- A group attacking a **planeswalker or a battle** docks on that card, not on its controller's seat.
- A **spectator** reads the same arrangement: the model comes from the view, not from the own seat.
- A seat that is **out** takes no column and no beam (CMB-4 already drops those arrows).
- **Extra combats** (CMB-7): a second declaration re-arranges, it does not stack columns.
