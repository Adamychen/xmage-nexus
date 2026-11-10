# Controls

Prefix: `CTL`

The shared controls every screen builds on (`web/src/ui/`): how a choice among values opens, looks
and answers the keyboard, wherever it sits. A screen's own rules (which values a picker offers, what a
choice does) live with that screen's area.

### CTL-1 · A choice among values opens the client's own list, the same on every screen
A control that picks one value from a list is the shared `Select` (`web/src/ui/Select.tsx`), not a
native `<select>`. It looks like the deck editor's filter dropdowns (DCK-22): the closed control shows
the chosen value and a chevron, and it opens a raised panel anchored under it, at least as wide as the
control and as wide as its longest option, with the chosen option highlighted. The panel opens upward
when there is more room above, shifts left when it would leave the window, and scrolls inside when the
list is taller than the room left. It is drawn above the page, so a dialog's edges never clip it, and it
keeps the appearance of the surface it was opened from (APR-1, APR-2). A click outside closes it without
changing the value and without closing the dialog behind it. A screen can bound the panel by its own
container instead of the window (the deck editor's filter bar), group the options under titled headers,
and keep the list open after a pick in one group (the language menu's card language).

- Why: the client had 29 native `<select>`s next to three hand-made menus and the deck editor's filter
  dropdowns. A native list opens in the operating system's style, so the same kind of choice looked
  and behaved differently from one screen to the next (inventory of 2026-11-06). Of the looks on offer,
  the filter dropdowns' was kept for every list (2026-11-10).
- Guard: `src/ui/Select.test.tsx`

### CTL-2 · The list answers the keyboard like a native one
On the closed control, ArrowDown, ArrowUp, Enter and Space open the list, and typing a letter picks the
next option that starts with it without opening. In the open list the arrows, Home, End, Page Up and
Page Down move a focus ring over the options, typing jumps to the first option that starts with the
typed letters, Enter or Space chooses the ringed option, and Escape closes the list without a change and
without closing the dialog it is in. Tab closes the list and moves on. Disabled options are skipped.
After a choice or Escape the focus is back on the control.

- Why: replacing native selects must not take away what they already did for keyboard players; the
  hand-made menus before CTL-1 only answered Tab.
- Guard: `src/ui/Select.test.tsx`

### CTL-3 · A long list starts with a search box
A list with more than 12 options (the country flags, for instance) opens with a search box that has the
focus, except when a touch opens it: there the box waits for a tap, so the on-screen keyboard does not
cover the list. Typing keeps the options whose text contains the words, ignoring case and accents; the
arrows and Enter work from the box, and a search that finds nothing says so with the filters' message. A
screen can ask for the box on a shorter list too.

- Why: the native country picker made the player scroll or type blind through 79 countries.
- Guard: `src/ui/Select.test.tsx` · `src/lobby/LoginScreen.test.tsx`

### CTL-4 · A list that takes several values stays open and checks each pick
When a control keeps several values (the card types, rarities and keywords of the deck editor's filters,
DCK-22), a click, Enter or Space on an option toggles it and the list stays open; each picked option is
highlighted and carries a gold check on its left, and the closed control names what is picked. Typing on
the closed control does nothing, since there is no single value to move to.

- Why: the filter dropdowns already worked this way before they moved onto `Select`, and a several-value
  list that closed after each pick would make the player reopen it for every value.
- Guard: `src/ui/Select.test.tsx`
