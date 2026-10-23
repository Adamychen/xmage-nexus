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
game") paint over it. A dialog opened from there stays above the board.

- Why: the "has left the game" overlay of an eliminated seat covered the lower half of Settings
  opened mid-game from ⋯ (Gameplay section).
- Guard: `src/game/GameMenu.test.tsx` · `e2e/game-menu-settings-overlay.spec.ts`
