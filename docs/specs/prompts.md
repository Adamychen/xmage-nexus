# Prompts and decisions

Prefix: `PRM`

A prompt is a server request for a decision (`GAME_TARGET`, `GAME_ASK`, `GAME_CHOOSE_*`,
`GAME_GET_AMOUNT`, …), parsed into a `FeedbackPrompt` and rendered by
`web/src/game/FeedbackDialog.tsx`. The guiding principle: **the player decides with the board in
view whenever the decision allows it**, and the UI never offers an answer the server will reject.

### PRM-1 · Only prompts that cover the screen count as blocking
`isBlockingModal` (`web/src/state/selectors.ts`) is true for prompts rendered as a screen-covering
dialog (card grids, modes, colours, library order, starting player) and for the other modals
(user request, sideboard, viewer, inspected card, draft, construct). It is false for in-board
interactions: mana payment, combat, plain targeting, the keep/mulligan bar, plain yes/no asks and
hand picks. While it is true, the board's hover preview and stack hover stand down.

- Why: the floating preview and the stack must keep working during in-board decisions, where the
  player is reading the board to answer, and must not float above a dialog (`89746e1dff`).
- Guard: `src/state/selectors.test.ts`

### PRM-2 · Keep or mulligan is a bar over the hand; the London bottom pick is a dialog
The opening-hand decision is a bar over the raised hand so the player sees the hand they are
judging. Choosing which cards go to the bottom (London mulligan) is a card dialog.

- Why: the player judges the hand they are looking at, so the decision sits over the raised hand
  instead of covering it.
- Guard: `src/state/selectors.test.ts`

### PRM-3 · A plain yes/no is a bar that names its source
A `GAME_ASK` yes/no with no dedicated dialog (pay life, optional costs, ward, cascade) is a
non-modal bar that names the card asking. Asks with a dedicated dialog (voting, starting player)
stay modal.

- Why: these asks are frequent and depend on the board state; they used a full-screen backdrop
  that hid the board and its hover previews (`89746e1dff`).
- Guard: `src/game/handPick.test.ts` · `src/state/selectors.test.ts` · `src/game/FeedbackDialog.test.tsx`

### PRM-4 · A pick from your own hand happens in the hand
When every card shown, and every legal option, is in the controller's hand (discard, put a card
back), the grid is skipped: the hand strip is highlighted and clickable and a compact bar shows
progress; the grid stays one click away. If any candidate lives elsewhere the grid is the picker.

- Why: the hand strip is already the natural picker, and the grid covered the board
  (`89746e1dff`).
- Guard: `src/game/handPick.test.ts` · `src/state/selectors.test.ts` · `src/game/FeedbackDialog.test.tsx`

### PRM-5 · Card grids show the legal cards first
A card grid shows only the cards the server will accept (`options.possibleTargets`) by default,
with a toggle to show every candidate; in the full list the illegal cards are disabled. A card
already chosen stays visible even when it is no longer selectable.

- Why: the grid showed every candidate, including the ones the target's filter rejects (a
  non-artifact in an "artifact card" tutor), and picking one did nothing (`6fccc8e84a`).
- Guard: `src/game/CardGrid.test.tsx`

### PRM-6 · Target picks go one card per click
For `GAME_TARGET`, each click sends one card and the server re-asks; picks already made come back
as chosen. The grid never collects several targets behind a Confirm button.

- Why: the engine keeps only the latest answer that arrives while it is busy and re-asks after
  every picked card, so a batched confirm lost every pick but the last (`df969dee61`).
- Guard: `src/game/CardGrid.test.tsx`

### PRM-7 · A required prompt has no cancel
A required prompt shows no cancel button, in a card grid or on the targeting bar; an optional one
shows a finish button instead of cancel, unless declining it backs out of the spell or ability being
played, where the same button says Cancel (PRM-13).

- Why: answering a required prompt with "cancel" makes the server ask again, so the button looked
  broken.
- Guard: `src/game/CardGrid.test.tsx` · `src/game/feedbackModes/promptBars.test.tsx`

### PRM-8 · The board shows where the choice lives
During a target choice the board rings the zone the candidates live in (graveyard, exile, library,
either hand, either battlefield), resolved per owner from the game view, with the prompt's
`targetZone` as fallback. A graveyard, exile or library pile holding the real target opens by
itself and closes when the targeting ends.

- Why: many prompts never say where the card comes from, and players read them as bugs.
- Guard: `src/board/targetZones.test.ts` · `e2e/graveyard-target.spec.ts`

### PRM-9 · An acknowledgement clears only the prompt it answered
When the proxy acknowledges an answer, the client clears the prompt only if it is still the one
that was answered.

- Why: callbacks and acks travel on different sockets, so the next prompt can arrive before the
  ack of the previous answer; clearing unconditionally wiped the new prompt and left the player
  waiting forever.
- Guard: `src/game/useFeedbackForm.test.ts`

### PRM-10 · Long choices are searchable and keyboard-driven
A choice grid with more than 7 options has a search box that filters while typing; Enter picks the
filtered option, and with a single option Enter sends it directly. In a single-choice grid a
double-click picks.

- Why: long choice lists (creature types, card names) are faster to answer by typing than by
  scanning (`1e5c54e840`).
- Guard: `src/game/FeedbackDialog.test.tsx` · `e2e/grid-search.spec.ts`

### PRM-11 · A target prompt with no legal card offers no card
A `GAME_TARGET` prompt that lists cards but carries no `options.possibleTargets` has no legal pick:
the engine omits that list only when it is empty. No shown card is selectable, the hand strip is not
a picker, and the prompt is answered by its finish button (the server sends it optional). A card
click there is never sent as an answer.

- Why: the client treated every shown card as a candidate when the list was missing. Each click was
  then refused, the engine asked the same discard again, and the dialog stayed open until the next
  priority pass, so the player saw a prompt they had already answered.
- Guard: `src/game/handPick.test.ts` · `src/game/feedback.test.ts`

### PRM-12 · The finish and confirm buttons of a card grid stay inside the dialog, whatever the list length
A card grid lists its cards in a scrolling area, and its footer (the confirm and finish buttons) sits
under that area. The dialog is a column whose list takes the space left over, so the footer is always
inside the dialog box: a long list of lands (30 cards) scrolls the list, never the buttons out of reach.

- Why: the list had its own height cap but the dialog did not shrink it, so the footer fell below the
  panel and the player had to scroll the dialog to find "Finish selection", which read as a forced
  pick of two lands (reported 2026-10-30, on the "up to two" land prompt).
- Guard: `e2e/card-grid-footer.spec.ts`

### PRM-13 · A spell or ability being played can always be backed out of
While the player is playing a spell or an activated ability, every step the server lets them back
out of offers Cancel, and Escape does the same: the ability picker ("Choose spell or ability to
play", including the planeswalker one), an activation's target, a cost picked on the board or in a
card grid, and the mana payment. Cancel answers `sendPlayerBoolean(false)`, which the engine reads as
abandoning the activation and rolls the game back to the state before it (nothing tapped, nothing
paid, priority back). A target says Cancel while the server sends it optional with no "Done" label
(`options['UI.right.btn.text']`) and Finish once it sends one, as the desktop client labels its
button. A mode picker that already lists the server's own Cancel entry gets no second one; Escape
picks that entry. Escape never cancels while another layer is open, while typing in a text field, or
when another handler (rewind, a menu) already used the key.

- Why: the engine never suppresses the ability picker for a non-mana activated ability
  (`HumanPlayer.suppressAbilityPicker`), and the web sent it as a required choice with no way out, so
  a player who clicked a permanent by mistake was stuck in the dialog; the activation's target said
  "Finish" where the desktop client says "Cancel", and Escape did nothing on any of these steps. The
  desktop client always adds Cancel to its ability picker and cancels it with the keyboard
  (`AbilityPicker.show`, `tryChoiceCancel`).
- Guard: `src/game/promptCancel.test.tsx` · `e2e/activated-ability-cancel.spec.ts`

### PRM-14 · Every trigger to order shows its source and the card it points at
In the trigger order dialog each row shows the card the trigger comes from and, when the trigger
points at objects (`CardView.targets`: its chosen targets or the card its effect follows, like
Tergrid's "that card"), each of those cards next to it, named with the zone it is in now ("in
Rival's graveyard"). The cards are looked up in the current game, so a card that already went to a
graveyard, exile or the stack is still shown; the source is the live permanent when it is still in
play. Every one of those cards has the same preview as the board: pointing at it or focusing it shows
the floating preview, a touch shows it without placing the trigger and keeps it until the next touch,
and a right click, a long press or Enter opens the card inspector. Rows of the same source repeat
the same rule, so their object comes first and their rule takes one line. The server's "Related
objects" line is shown only when one of the objects is not in the view. Remembering an order (always
first or last, by card or by text) is unchanged.

- Why: with Tergrid, God of Fright and several opponents discarding at once, the dialog listed three
  identical Tergrid rows whose only difference was a card name in small print, and that card, already
  in a graveyard, could not be looked at (reported 2026-11-11). The Swing client shows the trigger as
  a card and repeats the related object only as text.
- Guard: `src/game/TriggerOrderDialog.test.tsx` · `src/game/triggerOrder.test.ts` · `e2e/trigger-order.spec.ts`

### PRM-15 · Every card a prompt shows can be looked at without choosing it
Every card shown inside a prompt can be seen enlarged, as on the board, and looking at it never answers
the prompt: the card grid (scry, surveil, searching a library, looking at the top cards, picking from a
list, choosing targets), the library order dialog, the piles to choose from, the London mulligan's bottom
pick, the revealed and looked-at cards inside a prompt, and the revealed, looked-at and zone viewers. A
card that only shows (library order, piles, a revealed card nobody can play) is itself the preview
control: pointing at it or focusing it shows the floating preview, a touch shows it and keeps it until the
next touch (ACC-9), and a right click, a long press or Enter opens the card inspector. A card that is
chosen or played by a click keeps that click, on a tap too; pointing at it with a mouse or reaching it
with the keyboard shows the preview, and a zoom button in its corner, named "Zoom" and the card name,
shows the preview on a touch and opens the inspector on a click, Enter or Space. A card the prompt does not
accept (the full list of a grid) can still be looked at. A face-down card nobody may see has no zoom.

- Why: the dialogs that show cards to choose from had no preview on a phone and none at all in the card
  grid and the library order dialog, so a player searching a library or scrying could not read the cards
  (reported 2026-11-12). A tap on a grid card already answers the prompt, so on a touch screen the preview
  needs its own control; the mouse and the keyboard reach the preview without one, as on the board.
- Guard: `src/game/promptCardZoom.test.tsx`
