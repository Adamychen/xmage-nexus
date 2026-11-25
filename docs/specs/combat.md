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
- Guard: `e2e/combat-human.spec.ts` · `e2e/combat-undeclare.spec.ts`

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

### CMB-4 · An unblocked attacker draws its beam; a blocked one trades it for a tie
An attacker that nothing blocks draws a red beam to the defender its combat group names: a player's
avatar (not the middle of their zone), or the planeswalker or battle card being attacked. The moment
it is blocked that beam goes away and a gold tie takes its place, between the attacker and each
creature blocking it, with a head at both ends: the pair is what matters there, not a second attack.
Blocked is what the view itself says (`isBlocked`), not whether a blocker is still alive: a blocker
that dies in combat empties the group's blockers, and an attacker that was stopped must not read as
about to hit the player, so for the rest of that combat it draws neither beam nor tie. The beam
returns only when the view says the group is no longer blocked, which is what happens when the
defender takes the block back during the declaration. Several creatures blocking the same attacker land side by side on it, each on its own spot
and in their own left-to-right order, because two ties arriving at one point cannot be told apart. Arrows that start or end on a player who has left the game are not drawn.

- Why: aiming at the player's zone root put the arrow head in the lands band (`6fecaa53fd`,
  `web/INTERACTION_COVERAGE.md` §F); in a pod the arrow must follow the frame's defender, not the
  first non-active player (`e2e/recorded.spec.ts`, `pod-combat.json`). The seat-coloured attack
  arrows of the Table layout (`3392950fb4`) went with it on 2026-11-23. A blocker's own arrow back to
  its attacker crossed half the board; with the combat columns (CMB-14) the two sit one above the
  other, so the user asked for the red one to go and for a two-headed gold tie to say "this one was
  attacking and has been stopped" (25-nov-2026). Reading "blocked" as "it has blockers" brought the
  beam back the moment a blocker died: watching a game, an 8/8 Kraken blocked by a 3/3 pointed at the
  player again as soon as the 3/3 died, and stayed pointing until the end of combat (user report, same
  day). The beam still runs to the portrait rather than
  stopping at the edge of the defender's zone: with the opponents' boards in front, a beam that died
  at the edge read as an attack on a creature.
- Guard: `src/board/CombatArrowsOverlay.test.tsx` · `src/board/combatColumns.test.ts` (a planeswalker
  or battle defender and the left-player case are not asserted there)

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
any dialog read that flag — never the already-localized title. The confirm is the action button's
(PRM-19); the bar reads the flag for its own labels and does not repeat it. What those buttons say and where
they sit is CMB-13. Attack windows show attacker labels
and block windows blocker labels in every locale.

- Why: the old check looked for `atacan`/`attack` in `prompt.title`, which `feedback/parse.ts`
  sets with `t()`, so fr/de/it/ru/ja/zhs rendered the blocker label in the attack window
  (ROADMAP §4.3 finding; `CombatBar.tsx`, `GenericDialog.tsx`, `ActionButton.tsx`).
- Guard: `src/game/feedback.test.ts` · `src/game/feedbackModes/CombatBar.test.tsx` · `src/game/feedbackModes/GenericDialog.test.tsx` · `src/game/ActionButton.control.test.tsx`

### CMB-12 · A declaration ends only when the player confirms it
An attack or block declaration stays open, with its bar and its confirm button, until the player
confirms it, also once no creature is left to pick: after declaring your only attacker or blocker
the window is still the declaration, so clicking that creature takes it out and the main button
reads "Confirm attackers", never "Pass priority". Smart stops never answer a declaration window,
as in MTG Arena, where attacks and blocks are always confirmed by hand.

- Why: the server keeps the declaration open after each pick and sends the window again with
  `possibleAttackers` (or `possibleBlockers`) listing only the creatures still free to pick, so
  the list is empty once the only one is chosen. The client read an empty list as a priority
  window: the bar went away, the main button turned into "Pass priority" and the smart stops could
  answer it, which confirmed the attack with no way back. A player with one creature in a
  multiplayer game reported they could not take it out of the attack (2026-11-12). The server
  only sends the empty list when a declaration is already under way, so this adds no stop.
- Guard: `src/game/feedback.test.ts` · `src/state/store.test.ts` · `e2e/combat-undeclare.spec.ts`

### CMB-13 · The declaration reads as going forward or stepping back, and the count is in the words
While a declaration is open the corner holds two buttons and no more: going forward on the big one
(PRM-19), stepping back on the smaller one above it. With nothing declared, going forward is
declaring everything the server offers ("attack with everything", its special action) and stepping
back is "no attacks", which ends the declaration with none. With something declared, going forward
is "confirm N attackers", the count in the words and no icon beside them, and stepping back is
"cancel attacks", which only unmarks what is marked: each declared creature is clicked again, one
by one, and the declaration stays open. Blockers read the same way. Where the server offers no
"attack with everything", there is nothing to step back from and the big button is the only way
out.

- Why: our corner confirmed "attackers" when none were declared, which is not what pressing it did,
  and the only way to take a declaration back was to click every creature again with no button
  saying so. The shape is the one every other client of this game uses (user request, with
  screenshots, 24-nov-2026). Going to blockers is the player's decision, so cancelling never does
  it: only "no attacks" and the confirm advance the game.
- Guard: `src/game/feedbackModes/boardOrder.test.tsx`

### CMB-14 · A declared combat is read by position, not by lines
Who fights whom is read from where the cards stand. Inside each player's own board the creatures in
combat gather in columns, one per combat group of the view, with a gap of a third of a card between
columns and the creatures combat leaves alone kept behind them, dimmed. Both sides of a group carry
the same column number, so an attacker and the creatures blocking it hold the same place in the order
of their own boards and the pairing lines up across the table. Inside the block of one defender the
groups nothing blocks come first, so the beams that leave them stay on one side and never cross the
ties of the groups that are blocked. The gap a column opens is part of the
width the board's solver measures (BRD-25), so a seat's cards never run past its frame.

A group whose defender the view does not name takes no column, because nothing in the view says where
it belongs and the board never guesses it from whose turn it is.

- Why: an arrow per relation crossed the table four or five times in a multiple block and the
  blocker's curve looped over half the board; of the five arrangements studied, position is the only
  one that removes lines instead of drawing them better, and it is how MTG Arena reads without effort
  (combat-reading study and user decision, 24/25-nov-2026). Design and phases:
  `docs/plans/2026-11-25-combat-columns-design.md`. Blockers do not stand literally in front of their
  attacker: the user asked for the columns inside each board instead, because the seats already have
  a position at the table, and for the pairing to be told by a tie rather than by position alone
  (CMB-4, 25-nov-2026). The gap went into the solver's width model after the last blocker of a
  three-card row ran 53 px past its seat's frame.
- Guard: `src/board/combatColumns.test.ts` · `src/board/layout/itemModel.test.ts`
