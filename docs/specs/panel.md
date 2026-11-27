# Game side panel

Prefix: `PNL`

The panels that hold the game's log, chat and mechanics. Log and chat open in a
panel that floats over the left edge of the board (PNL-10); mechanics drop down
from the strip's button (`GameDrawer`, with `MechanicsTray`); commander damage
received opens from a chevron beside each player's life total (PNL-11). The
Table (v2) interface and its left side panel were removed on 2026-11-23 with the one Arena layout,
which retired the rules about that panel's header and views (PNL-1, PNL-7, PNL-8).

The design these rules come from is the 2026-10-27 canvas "Panel lateral v2": a before board with
the captured panel and fifteen numbered issues, and the proposal boards for every tab.

### PNL-1 · The panel header is a row of tab icons, and its close button is always inside the panel
Retired 2026-11-23: the Table (v2) interface was removed when every game moved to the one Arena layout; its left panel and header went with it, and chat and log open in their own floating panel (PNL-10).

- Guard: none yet (retired)

### PNL-2 · A player is told apart by their seat colour in every tab
Wherever a player's name appears in the panel (the log sentence, the turn divider, a chat sender,
the commander matrix, a mechanic's owner, the table state), it is drawn in that player's seat colour,
the colour of their avatar on the board (`seatColorVar`). There is no green "you" tag and no red
"opponent" tag; the own player is the own seat colour.

- Why: the log tagged the own player green and every opponent red, the same red as damage, while the
  board, the commander matrix and the mechanics already used seat colours; the chat drew every sender
  in the same blue. Four players could not be told apart in the log or the chat (review of 2026-10-27).
- Guard: `src/game/ActionFeedCard.test.tsx` · `src/game/GameChat.test.tsx`

### PNL-3 · A log event is one row that says it once
In the visual log each event is one compact row: an icon for the kind of event in a small tinted
square, the event's sentence, a damage or life chip ("−4", "+3") when it has one, and the time as
hours and minutes (the full time in its tooltip). In the sentence card names are hover links to the
card (gold) and player names take their seat colour (PNL-2). The card name, the target and the player
are not repeated outside the sentence, and the card art is not painted behind the row; hovering a card
name shows the card, and only its name does: the row itself opens nothing, however much of it the
pointer crosses. Rows are grouped under the turn divider, which stays. The text view is unchanged.
At 1440×900 with the side panel on (BRD-6), the log panel shows at least fifteen events at once.

- Why: every event was a 50–80 px card that said the card name, the target and the player twice
  ("FOREST · Adam juega Forest"), with the same time on all of them, the sentence on a black box and
  the art at 25 % that could barely be seen; ten events filled the panel (review of 2026-10-27).
  The row kept a hover of its own, anchored to its whole width, so reading the log opened a card
  preview over the board on every row the pointer passed (user report, 25-nov-2026).
- Guard: `src/game/ActionFeedCard.test.tsx` · `e2e/arena-chrome.spec.ts`

### PNL-4 · Chat messages are bubbles, mine on the right
Each chat message is a bubble under its sender's name (seat colour) and time. The own messages sit
on the right in a bubble tinted with the own seat colour; the others sit on the left. Card names in a
message stay hover links. The lobby switch is in the tab's title bar; the emoji picker, the input, the
send button and the quick reactions are unchanged.

- Why: every message was one line with every sender in the same blue, so the own messages and the
  speakers could not be told apart (review of 2026-10-27).
- Guard: `src/game/GameChat.test.tsx`

### PNL-5 · The deck tracker knows every card of the list, seen or not
Retired 2026-11-23: the deck tracker was removed with the one Arena layout (user decision): MTG Arena has none, and its tab was one more thing in a panel the board no longer makes room for.

- Guard: none yet (retired)

### PNL-6 · The deck tracker labels its counts, groups the cards by type and folds the drawn ones away
Retired 2026-11-23: the deck tracker was removed with the one Arena layout (user decision): MTG Arena has none, and its tab was one more thing in a panel the board no longer makes room for.

- Guard: none yet (retired)

### PNL-7 · Commander damage keeps its matrix, with a one-line help, each column's commander and a threat bar
Retired 2026-11-23: the Table (v2) interface was removed when every game moved to the one Arena layout; the drawer's `CommanderDamageMatrix` stays until commander damage moves under each player's life.

- Guard: none yet (retired)

### PNL-8 · Each mechanic in play is a card that names its owner
Retired 2026-11-23: the Table (v2) interface was removed when every game moved to the one Arena layout; the mechanics drawer keeps `MechanicsTray` until mechanics become badges on the board.

- Guard: none yet (retired)

### PNL-9 · With no mechanic in play, the tab explains each one correctly
When no table mechanic is in play the mechanics tab says so and lists, one line each,
what the Ring tempting you, dungeons, day and night, the monarch, the initiative, the city's blessing
and speed do, each with its own text.

- Why: the empty state's glossary reused unrelated translation keys, so it read "Day / Night: Priority —
  respond to spells", "Monarch / Initiative: The Monarch" and "Dungeon: Dungeon active:", and its title
  appeared twice (review of 2026-10-27).
- Guard: `src/game/MechanicsGlossary.test.tsx` · `src/game/MechanicsTray.test.tsx`

### PNL-10 · Chat and log float over the left edge of the board
The log and the chat open from two buttons in the phase strip, next to the commander and mechanics
buttons, into one panel that floats over the left edge of the board, starting just under the phase
strip (wherever the strip is drawn) and ending above the hand, so it never covers the strip, the
opponents' boards in the column mode or the action button. It has a tab for each, and opening,
switching or closing it never resizes or moves the board: it lies over the cards like the stack
does (STK-2). It is closed by default, the same button or its close button closes it, and Escape
closes it before it reaches anything else (a second Escape cancels the prompt as before). The chat
button counts the messages that arrived while the chat was not shown; system lines do not count.

- Why: the Table (v2) interface gave log and chat a 372 px column at the left that pushed the
  board, and with the side panel of BRD-6 on the right the main board was squeezed from both
  sides; the user wanted one Arena layout as close to MTG Arena as possible, where the table
  stays clear and the chat is out of sight until asked for (2026-11-23). Drawn from the top of the
  board it covered the strip and an opponent's life.
- Guard: `src/game/ChatLogPanel.test.tsx` · `src/game/GameScreen.test.tsx`

### PNL-11 · Commander damage opens from a chevron beside each player's life total
When an opponent controls a commander, a chevron button sits beside that player's life total in
`PlayerInfoBar` (`CommanderDamageDropdown`). Clicking it opens a floating dropdown listing each
opponent, their commander, and the commander damage received by that player (warning at 15+, lethal
at 21+), without triggering player targeting and closing on outside click or Escape. The toolbar
crown button and `CommanderDamageMatrix` are removed.

- Why: commander damage is a per-player property tied to life totals; a matrix in a toolbar drawer
  forced players to look away from the seat they were attacking or defending (step 2 of
  `docs/plans/2026-11-23-arena-only-design.md`, 2026-11-25).
- Guard: `src/game/CommanderDamageDropdown.test.tsx` · `src/game/GameDrawer.test.tsx`
### PNL-12 · The commander damage panel opens where it fits, and never off the screen
The panel of PNL-11 opens away from the board: the own seat's upwards, an opponent's downwards.
That is a preference, not a rule about the screen. When the chosen side has no room for the panel
it turns over to the other one, and when neither side has room the panel is held on screen and its
list scrolls, so a table with many commanders can still be read.

- Why: the own panel was anchored by its bottom edge to the top of its button with nothing checking
  that it fitted, so on a board where the button sits high (the side panel open, a short window, a
  long list of commanders) it grew upwards past the top of the screen and the player saw a strip of
  it or nothing: "el daño de commander de mi tablero en modo panel lateral se despliega hacia
  arriba y no se ve" (26-nov-2026). The placement is a pure function of the button's box, the
  panel's height and the viewport, so it is decided once and tested without a browser.
- Guard: `src/game/damagePanelPlacement.test.ts`

