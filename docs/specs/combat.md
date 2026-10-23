# Combat

Prefix: `CMB`

The server opens a declaration window with a `GAME_SELECT` that carries
`options.possibleAttackers` or `options.possibleBlockers` (`web/src/game/feedback/parse.ts`,
`combatFromSelect` in `web/src/state/gameUtils.ts`). The creatures are picked on the board and the
declaration is answered from `web/src/game/feedbackModes/CombatBar.tsx`; the arrows are
`web/src/board/CombatArrowsOverlay.tsx`. That combat is an in-board, non-blocking interaction is
PRM-1; Space confirming a declaration is KEY-1; how the strikes animate is FX-6. The guiding
principle: **the server decides who may attack, block and be attacked**, and the board shows the
combat the server's view describes.

### CMB-1 · Attackers and blockers are picked by clicking creatures on the board
While a declaration window is open, the creatures the server lists are clickable on the
battlefield. Each click sends that creature to the server, which toggles it: a declared creature
is marked as chosen, and clicking it again takes it out of the attack or the block. A combat pick
wins over any other use of the same click (TGT-4).

- Why: interactive combat landed in `aa0b97479f` (click the creature, then confirm); `03b44adda5`
  kept a chosen creature clickable, because the server may drop it from `possibleAttackers` once
  it is chosen and the player could no longer undeclare it.
- Guard: `e2e/combat-human.spec.ts` (clicking a chosen creature again is not asserted)

### CMB-2 · The combat bar finishes the declaration; "Attack all" only when the server offers it
The declaration window is a bar in the dock that says whether attackers or blockers are being
declared and hints to click creatures. Its confirm button finishes the declaration (a `false`
boolean, the server's "done"). An "Attack all" button appears only when the server's window
carries a special button, and sends `special`. There is no cancel: the declaration is finished,
with or without creatures, never dismissed.

- Why: so that the bar offers only answers the server accepts: XMage finishes a declaration with
  a boolean and declares every attacker with `special` only in a window that offered the button.
- Guard: `e2e/combat-human.spec.ts` ("Attack all" and the absence of cancel are not asserted)

### CMB-3 · Who is attacking or blocking comes from the server's combat groups
The attacking and blocking marks on creatures are read from the combat groups of the game view
(`game.combat`), not from per-card flags, so a spectator sees them too. An attacker is drawn
tapped from the moment it attacks unless it has vigilance, and vigilance counts only when the
creature has the keyword itself (a keyword line or the server's vigilance icon), not when its
text merely mentions it ("create a token with vigilance").

- Why: the view has no `attacking` field and `tapped` arrives late or not at all outside the
  declare steps (`combatActorsFrom`, `web/INTERACTION_COVERAGE.md` §F); keyword-ability lines only
  (`docs/lessons.md`, Web client: `hasVigilance` decides whether an attacker is drawn tapped).
  `07501e3ea3` made the rotation real after a stuck animation pinned the attacker upright.
- Guard: `src/state/gameUtils.test.ts` · `src/cards/cardImages.test.ts` · `e2e/combat.spec.ts`

### CMB-4 · Each attack arrow lands on the defender the server names
Every attacker draws an arrow to the defender its combat group names: a player's avatar (not the
middle of their zone), or the planeswalker or battle card being attacked. Every blocker draws an
arrow to the attacker it blocks. In the Table layout the arrow takes the attacker's seat colour
and ends on the defender's edge. Arrows that start or end on a player who has left the game are
not drawn.

- Why: aiming at the player's zone root put the arrow head in the lands band (`6fecaa53fd`,
  `web/INTERACTION_COVERAGE.md` §F); in a pod the arrow must follow the frame's defender, not the
  first non-active player (`e2e/recorded.spec.ts`, `pod-combat.json`). Seat colours came with the
  Table layout (`3392950fb4`).
- Guard: `src/board/CombatArrowsOverlay.test.tsx` (blocker arrows, a planeswalker or battle
  defender and the left-player case are not asserted there)

### CMB-5 · Combat arrows give way to the game menu
The arrow layer paints above the side drawer so combat stays readable, but drops below the game
menu while the menu is open, so arrows never cross its options.

- Why: `b36e713f6b`; the arrows' drawer override and the dock covered the menu's popups
  (`docs/lessons.md`, Web client: chrome layering is decided by stacking contexts).
- Guard: `e2e/game-menu-overlay.spec.ts`

### CMB-6 · Combat damage is detected by crossing the damage steps
The client knows combat damage was dealt when one view to the next crosses the first-strike or
the regular damage step, including jumps from declaring blockers straight to end of combat, the
second main phase or the next turn. It never waits for a frame whose step is a damage step, and a
transition that starts after damage was already dealt is not damage.

- Why: the real server usually sends no frame for the damage steps; a live game goes from
  `DECLARE_BLOCKERS` to `END_COMBAT` or `POSTCOMBAT_MAIN` (`docs/lessons.md`, Web client). Recorded
  frames that do show `COMBAT_DAMAGE` misled the first version of the strikes.
- Guard: `src/board/combatStrikes.test.ts` · `e2e/combat-strikes.spec.ts`

### CMB-7 · An extra combat never freezes the board
Views of the same game are ordered by the server's message id, not by turn and step, so an extra
combat (the step going back to declare attackers within the same turn) and the damage steps after
blockers are shown. Only a view from an earlier turn is ignored as stale, unless a rollback is
armed.

- Why: the turn/step guard froze the board for the rest of the turn after an extra combat, and
  ranked the damage steps below declare blockers (`a64c4d08d2`, `docs/lessons.md`, Web client).
- Guard: `src/state/store.test.ts`

### CMB-8 · Damage among several blockers is assigned in one dialog
When a blocked attacker must split its damage, the server asks once (`GAME_GET_MULTI_AMOUNT`):
one row per blocker, prefilled with the server's default split in declaration order. There is no
separate step to order the blockers first. The dialog has no cancel unless the server says the
assignment can be cancelled.

- Why: verified live on 2026-09-12 (`web/INTERACTION_COVERAGE.md`, `GAME_GET_MULTI_AMOUNT`: a
  gang block's damage split arrives with defaults and no order prompt before it); without
  `canCancel` the engine expects numbers and a cancel is not a valid answer (`parse.ts`).
- Guard: `src/game/feedback.test.ts`

### CMB-9 · A declaration window calls a player who is away
When the tab is in the background, a new attack or block window counts as a prompt that needs the
player: it raises the attention alert (the count in the tab title and, when enabled, a browser
notification), even during the opponent's turn.

- Why: so that a player who switched tabs does not let the declaration time out; combat windows
  have no `feedback` prompt of their own, so the combat state feeds the prompt signature.
- Guard: `src/game/attentionAlerts.test.ts`

### CMB-10 · The server decides which defenders are in range
The client never filters who can be attacked. When an attacker has more than one legal defender
(another player, a planeswalker, a battle), the server asks which one ("Select a player,
planeswalker, or battle to attack") and the client answers like any other target pick; range of
influence is applied there, by the server. The board does not mark players outside the range of
influence.

- Why: `PlayerView.inRange` is an accepted gap (`web/src/state/engineViewRegistry.ts`: the desktop
  client does not show it either); the defender prompt was recorded live in `attack-pw.json`
  (`web/INTERACTION_COVERAGE.md` §F, attacking a planeswalker or battle).
- Guard: none yet (no test drives the defender choice of a multiplayer attack)

### CMB-11 · The declaration window reads attackers vs blockers from the prompt, not from its translated title
The combat declaration prompt carries its direction as structured data: `GAME_SELECT` with
`options.possibleAttackers` sets `prompt.isDeclaringAttackers`, and the bar, the action button and
any dialog read that flag — never the already-localized title. Attack windows show attacker labels
and block windows blocker labels in every locale.

- Why: the old check looked for `atacan`/`attack` in `prompt.title`, which `feedback/parse.ts`
  sets with `t()`, so fr/de/it/ru/ja/zhs rendered the blocker label in the attack window
  (ROADMAP §4.3 finding; `CombatBar.tsx`, `GenericDialog.tsx`, `ActionButton.tsx`).
- Guard: `src/game/feedback.test.ts` · `src/game/feedbackModes/CombatBar.test.tsx` · `src/game/feedbackModes/GenericDialog.test.tsx` · `src/game/ActionButton.control.test.tsx`
