# Dialogs and layers

Prefix: `DLG`

Every screen-covering dialog renders through `web/src/ui/Modal.tsx`, usually via
`web/src/ui/DialogShell.tsx`. Board FX overlays (`web/src/board/*Overlay.tsx`) are a separate
fixed layer. These rules apply to both.

### DLG-1 · Later dialogs open above earlier ones
A dialog opened while another is open always paints above it. Dialog z-indexes come from one
counter in the range 500–1999; the counter only wraps back to 500 when no dialog is open, so it
never places a new dialog under an open one.

- Why: nested dialogs are normal (inspecting a card from inside a card grid); since `00553ccb9a`
  the z-index is assigned at mount so the last one opened is on top. The cap keeps every dialog
  below the board FX layer (DLG-7).
- Guard: `src/ui/Modal.test.tsx`

### DLG-2 · Escape closes only the top layer, and only when it has a way to close
One Escape press closes exactly the topmost layer and hands the next press to the layer beneath.
A dialog with no close path (a server prompt that must be answered) does not consume Escape.

- Why: with nested dialogs, one Escape must unwind one level, not all of them; a prompt that must
  be answered has nothing to close, so it leaves Escape to whatever is beneath it.
- Guard: `src/ui/Modal.test.tsx` · `src/ui/useEscape.test.tsx` · `src/ui/DialogShell.test.tsx`

### DLG-3 · Focus enters the dialog and stays there
Opening a dialog moves focus to its first control (or the dialog itself); Tab and Shift+Tab cycle
inside it while it is the top layer; closing it restores the focus that was there before.

- Why: keyboard and screen-reader users (WCAG 2.4.3): without the trap, Tab leaves the dialog for
  the board behind it. Added in the interactive audit (`f08ed4e46b`).
- Guard: `src/ui/Modal.test.tsx`

### DLG-4 · Clicking the backdrop does nothing unless the dialog opts in
The backdrop intercepts clicks so nothing reaches the board, and by default a click on it does
not close the dialog. A dialog that is safe to dismiss passes `onBackdropClick` explicitly.

- Why: most dialogs are server prompts that cannot be dismissed client-side, or forms whose input
  a stray click would throw away.
- Guard: `src/ui/Modal.test.tsx`

### DLG-5 · Holding Alt shows the board behind any dialog, visually only
While Alt is held, the backdrop of every open dialog turns transparent so the player can read the
board; releasing Alt, or the window losing focus, restores it. The backdrop keeps intercepting
clicks during the peek, so peeking can never trigger a game action.

- Why: blocking prompts cover the board the player needs to read to answer them (`89746e1dff`).
- Guard: `src/ui/Modal.test.tsx` (the toggle; click interception during the peek is CSS and is
  not asserted)

### DLG-6 · A blocking prompt that covers the board shows how to see it
A prompt that hides the board and cannot be closed (library search, tutor) shows a visible hint
for the peek of DLG-5, hides its own panel while peeking, and lets the player peek as many times
as they want before answering. The hint covers neither the opponent's piles nor the panel.

- Why: PR #24. The Alt peek existed but nothing on screen mentioned it, and on Windows it worked
  once per prompt (releasing a lone Alt hands focus to the browser menu).
- Guard: `src/game/CardGrid.test.tsx` · `src/ui/Modal.test.tsx`

### DLG-7 · Cosmetic overlays step aside for blocking dialogs
Board FX overlays sit at z-index 999970 and above, over every dialog. A purely decorative one
(the starting-player coin) clears itself while a blocking dialog is open; an informative one
(a dice roll whose result matters for the next choice) stays on top.

- Why: PR #24. The coin spun over the middle of a card grid that arrived during the toss.
- Guard: `src/board/CoinFlipOverlay.test.tsx`

### DLG-8 · No native browser dialogs
Nothing calls `window.confirm`, `alert` or `prompt`; confirmations go through `confirmDialog` /
`alertDialog` (`web/src/ui/ConfirmModal.tsx`).

- Why: the desktop app's Tauri/macOS webview has none of them, so the call silently did nothing.
- Guard: `src/ui/nativeDialogs.test.ts`

### DLG-9 · One close button
Every dialog's ✕ is the shared `CloseButton`, centred without depending on font metrics.

- Why: the ✕ was redefined in 22 stylesheets, from 22 to 32 px, and 12 of them had no accessible
  name (`7d0b984437`); the shared button always carries an `aria-label`.
- Guard: `src/ui/modalCloseCentering.test.ts`

### DLG-10 · A dialog takes at most 70% of the screen height
Every dialog and popup is capped at `--dlg-max-h: 70vh`; longer content scrolls inside the body.

- Why: issue #12. A share of the screen instead of a pixel height fits every screen and leaves
  part of the board in view.
- Guard: `src/ui/DialogShell.overflow.test.ts`

### DLG-11 · A dialog opened from the game's top bar is not trapped by it
The game menu (⋯) opens Settings, Help and Report on the body, not inside the top bar. The top
bar and the dock are stacking contexts (z-index 36 and 29), so an inline dialog is ranked as a
whole at their level and the board's zone overlays (z-index 30, for example "X has left the
game") paint over it. A dialog opened from there stays above the board. Which one is open is the
game screen's, not the menu's: the menu lives in the board's strip, and a setting that swaps the
board, the side panel's switch, takes the menu with it. Opening one closes the menu behind it.

- Why: the "has left the game" overlay of an eliminated seat covered the lower half of Settings
  opened mid-game from ⋯ (Gameplay section). Turning the side panel on or off from that very
  window then closed it, because the board it hung from was replaced underneath (28-nov-2026).
- Guard: `src/game/GameMenu.test.tsx` · `src/game/GameScreen.test.tsx` · `e2e/game-menu-settings-overlay.spec.ts`

### DLG-15 · The menu of the top strip opens over the stack and closes on a click anywhere
The dropdown of the game menu (⋯) and the drawer that opens beside it are read over everything the
board draws, the stack included, and the sheet that closes them on a click outside covers the
window. While one of them is open the strip rises above the stack and above that sheet; closed, it
goes back under the stack, which rises over the board's chrome on purpose when it is tall.

- Why: the pill that holds the strip's buttons blurs its backdrop, which makes it a stacking
  context and the containing block of anything fixed inside it. So the panel's own `z-index` never
  left the strip (ranked at 30, under the stack's 38) and the stack painted over the open menu
  (user report, 2026-11-28); the sheet meant to cover the window came out 129×32, the size of the
  pill, so a click on the board did not close the menu either. The sheet is drawn on the body now,
  and the strip rises over it while something is open in it.
- Guard: `e2e/game-menu-settings-overlay.spec.ts`

### DLG-12 · A destructive confirmation starts on Cancel; any other confirmation starts on its action
When a confirmation asks for something destructive (delete, leave, concede, clear), the focus starts on
Cancel, so Return cancels. Any other confirmation starts its action button focused, so Return
confirms. A confirmation with no Cancel starts on its one button.

- Why: a confirmation that always focused Cancel made Return cancel every confirmation, including the
  ones that only confirm a choice the player just made. Apple's button guidance gives the primary role to
  the action people are most likely to choose; for a destructive choice that is the safe option.
- Guard: `src/ui/ConfirmModal.test.tsx`

### DLG-13 · The rewind vote asks without taking the screen
The dialog that puts a rollback to the table is the one dialog that does not block what is behind
it: nothing is dimmed or covered, the board and the side panel keep their clicks, no focus is taken
and Tab is not trapped, and it carries no `aria-modal`. It sits at the top of the screen so the
game under it stays readable. Every other dialog keeps its backdrop: this one asks a question whose
answer is read off the board, and often discussed in the chat first.

- Why: with a rewind pending a player could do nothing at all, "not even see the chat", while the
  vote he was being asked about was a change to the game he had just played (user, 2026-11-26).
  The modal's Alt-peek shows the board but takes no clicks, so it did not answer this.
- Guard: `src/game/RollbackVoteDialog.test.tsx` · `src/ui/Modal.test.tsx`

### DLG-14 · A question can be set aside to read the board, and stays aside
The button a full-screen question offers for reading the board (`View battlefield`) is a switch,
not something to hold down: one press puts the question aside, the button becomes the way back and
nothing else ends the peek, so the player can take as long as they need. While the question is
aside the board takes the pointer, so a card answers a hover and the stack can be read with its
arrows, and every click that falls on the board is swallowed: a look is a look, never a play.
Escape comes back to the question instead of reaching the prompt's own cancel.

- Why: the button was held down (`onPointerDown`/`onPointerUp`), so the board came back the moment
  the pointer moved off it and the question returned over whatever the player was reading. Asked
  for after a trigger's mode question covered the stack: "al pulsar lo de ver el campo de batalla
  tampoco me dejaba ver la pila y mirar la flecha porque al mover el ratón volvía a salir la
  pantalla de la pregunta" (27-nov-2026). The mulligan screen already worked this way (PRM-2),
  which is where the shape comes from; the Alt peek of DLG-5 is the other thing and is unchanged,
  held down and holding its backdrop in front.
- Guard: `src/game/arena/ArenaPromptShell.test.tsx`
