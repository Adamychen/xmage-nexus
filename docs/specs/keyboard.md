# Keyboard shortcuts

Prefix: `KEY`

The game shortcuts live in `web/src/game/GameScreen.tsx` (Space and the skip keys, both window
`keydown` listeners) with the skip table in `web/src/game/skips.ts`; the rest belong to the
screen or component they act on (`App.tsx` zoom, `RewindBar`, `DraftScreen`, the card preview and
inspector, the option grids). Keys inside dialogs (Escape, the Tab trap, the Alt peek) are
DLG-2, DLG-3 and DLG-5; Enter and the search box in long choice grids are PRM-10.

### KEY-1 · Space passes priority, or confirms attackers and blockers
On the game screen Space does what the big action button does: pass priority (which resolves the
top of the stack) or, while attackers or blockers are being declared, confirm the declaration. It
acts only when the button would (the player holds priority, controls the acting player, or is the
active player with no prompt open), and it never scrolls the page.

- Why: Space has been the pass key since the action button was introduced (`6a3a192304`); it
  follows the button's own condition (`canPass`) so the key never does what the button would not.
- Guard: `src/game/GameScreen.space.test.ts` · `src/game/GameScreen.keys.test.tsx`

### KEY-2 · Space keeps passing after a click on the board
Inside the game area Space is always the pass shortcut. A card selected with the mouse keeps
focus but activates with Enter, not Space; a game control the mouse left focused (the log toggle,
a tab, a toggle button) is released, and Space passes priority instead of pressing it again.

- Why: after selecting a card, Space re-activated the card instead of passing (`61cce0db84`);
  after clicking the log toggle, Space stopped passing until the player clicked elsewhere
  (`492bb28851`, `docs/lessons.md`).
- Guard: `src/game/GameScreen.space.test.ts` · `src/ui/clickable.test.ts` · `src/board/CardSlot.test.tsx`

### KEY-3 · Shortcuts leave typing and keyboard focus alone
Space does not fire the shortcut while focus is in a text field, a select or an editable area, on
a link or native button reached with the keyboard, or on a menu item or option outside the game
area: there it keeps its native meaning, so one key press never does two things. Text fields,
dialogs and menus are never released by KEY-2. The skip keys are ignored while typing in a text
field.

- Why: the keyboard audit (`ecef5aa497`, "Space without double firing"): a focused control plus
  the global pass acted twice.
- Guard: `src/game/GameScreen.space.test.ts`

### KEY-4 · Game shortcuts stand down while something else is being decided
Space and the skip keys send nothing while a prompt is open (targets, mana payment, a yes/no, a
card grid: any prompt except declaring attackers or blockers), while a rollback vote is open, or
while the player is looking at an earlier board in rewind. Space also stands down while a viewer
is open (a graveyard or exile pile, the cross-zone list, a hand viewer, the card inspector), even
when focus fell to the page behind it; inside the viewer Space activates the focused control, as
in a dialog.

- Why: Space passed blindly while a mana or target prompt was open (`d132b1259b`); during a
  rollback vote the requester must keep priority so the game cannot drift past the turn being
  voted on (`d1e18a9d03`); a rewound board is read-only (`a7143aebc1`); viewers: `61cce0db84`.
- Guard: `src/game/GameScreen.space.test.ts` · `src/ui/clickable.test.ts` (the viewer condition;
  the prompt, vote and rewind conditions are not asserted)

### KEY-5 · A held key acts once
Holding Space or a skip key sends one pass or one skip; the keyboard's auto-repeat is ignored.

- Why: `8fbb005e7b` ("Holding a key no longer repeats passes"), so that a held key cannot pass
  through priority windows the player never saw.
- Guard: `src/game/GameScreen.keys.test.tsx`

### KEY-6 · F4 to F11 are the desktop client's skips, F3 cancels
F4 (next turn), F5 (end step), F7 (next main phase), F9 (my next turn), F10 (stack resolved) and
F11 (end step before my turn) send the same one-shot skips as the desktop client and as the ▾ menu
beside the pass button; F3 cancels the active skip. There is no F6. The menu offers its cancel
entry only while a skip is active. On the game screen, outside text fields, these keys replace the
browser's own F5 (reload) and F11 (full screen).

- Why: desktop parity (G11-1, `f1af392cc6`); F6 is left out because the desktop client has it
  disabled (`web/COMPONENT_PARITY.md`, U11 game panel).
- Guard: `src/game/PassMenu.test.tsx` · `src/game/GameScreen.keys.test.tsx` · `e2e/skips.spec.ts`

### KEY-7 · Digits pick the numbered option
In a yes/no bar and in an option grid every option shows its number, and pressing 1 to 9 picks
that option (the number counts in the filtered list when the grid has a search). The digits act
while focus is inside the options. The trigger-order dialog has no digit shortcuts.

- Why: the keyboard audit added arrows and digits to the grids (`ecef5aa497`); the trigger-order
  redesign left digits out on purpose (`ROADMAP.md` §4, 2026-09-29 trigger-order row).
- Guard: `src/game/feedbackModes/AskBar.test.tsx` · `src/game/feedbackModes/GenericDialog.test.tsx`

### KEY-8 · Shortcuts are fixed and shown where they act
Shortcuts cannot be rebound. Each one is shown where it applies: a key cap on the pass button
(whose label does not repeat "(Space)"), the F-key beside each entry of the ▾ skip menu and in its
tooltip, the number on each option, "(F9)" on the draft's hidden-picks link and the Shift/F hint on
the flip badge. The help wiki's Shortcuts & Controls tab lists Space, the skip keys with F3,
Ctrl/Cmd + click, Shift/F and Esc.

- Why: the desktop client's custom hotkeys are a declared difference: the web has fixed
  shortcuts, documented in the wiki (`web/COMPONENT_PARITY.md`, U15). "(Space)" left the
  translated label because the key cap already says it and the button clipped it (`c878e328f8`).
- Guard: `src/game/PassMenu.test.tsx` · `src/game/HelpWikiModal.test.tsx` (the pass button's key
  cap and the option numbers are not asserted)

### KEY-9 · Shift or F flips the card being looked at
While the hover preview or the card inspector shows a card with a second face (transforming,
modal double-faced, or one with an alternate face), Shift or F shows the other face; pressing again
turns it back. A face-down card has nothing to flip.

- Why: so that the back face can be read without leaving the board.
- Guard: `src/board/FloatingCardPreview.test.tsx`

### KEY-10 · A modifier click on a playable card holds priority
Clicking a castable card or ability with Ctrl, Cmd or Shift held sends the hold-priority request
before the play, so the player keeps priority after casting, as with the Hold priority toggle in
the ▾ menu.

- Why: so that a player can respond to their own spell without switching the toggle on and off;
  the toggle's tooltip names the modifier.
- Guard: none yet (no test clicks a playable with a modifier held)

### KEY-11 · Ctrl or Cmd with =, - and 0 zoom the interface
On every screen, Ctrl (Cmd on macOS) with = or +, - or _, and 0 steps the interface zoom up,
down, or back to 100%, like a browser, and replaces the browser's own page zoom.

- Why: browser-like continuous zoom (`78133122ec`), so that the zoom a player reaches for goes
  through the app's scale, which the settings stepper and presets show.
- Guard: `e2e/zoom.spec.ts`

### KEY-12 · Screen keys: rewind and draft
While looking at an earlier board in rewind, the left and right arrows step one snapshot back or
forward and Esc returns to the live board (not while typing in a text field). In a draft, F9 shows
again the picks the player hid.

- Why: rewind shipped with its slider, arrows and Esc (`a7143aebc1`); F9 for hidden picks is
  desktop draft parity (U9-1, `34c7cc2436`).
- Guard: `src/game/RewindBar.test.tsx` · `src/game/DraftScreen.test.tsx`
