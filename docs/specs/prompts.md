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
shows a finish button instead of cancel.

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
