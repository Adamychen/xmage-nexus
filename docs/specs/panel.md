# Game side panel

Prefix: `PNL`

The panel that holds the game's log, chat, deck tracker, commander damage and mechanics. In the
v2 interface it opens on the left of the board (`SidePanel`); the classic interface shows the same
content in its right drawer (`GameDrawer`). The content of each tab is shared by both, so these
rules hold in both unless a rule names one. The header (PNL-1) is the v2 panel's; the commander
matrix (PNL-7) and the mechanics cards (PNL-8) are the v2 views (the classic drawer keeps
`CommanderDamageMatrix` and `MechanicsTray`).

The design these rules come from is the 2026-10-27 canvas "Panel lateral v2": a before board with
the captured panel and fifteen numbered issues, and the proposal boards for every tab.

### PNL-1 · The panel header is a row of tab icons, and its close button is always inside the panel
The header of the v2 panel is one row: a button per tab with the same icon the top bar uses to open
that tab (log, chat, deck, commander, mechanics), then the close button at the right edge. Each
button has the tab's name as its tooltip and accessible name, and the selected one is marked (gold,
`aria-selected`). The chat button carries the unread count and the mechanics button the number of
active mechanics, the same number the top bar shows, in the icon's corner. Under the header every
tab starts with a title bar: the tab's name in the display face and that tab's own controls (the log's
visual/text switch, the chat's lobby switch, the actions a tab puts in the head slot). The close
button is inside the panel and clickable at every window size, with every tab shown and both badges
present.

- Why: the five text tabs did not fit 372 px. With the mechanics badge on, "Mecánicas" was cut and the
  close button was pushed outside the panel at 1440 and at 1280 wide, so the panel could only be closed
  from the top bar. The tabs were also the only place where these tabs had no icon (review of 2026-10-27).
- Guard: `src/game/SidePanel.test.tsx` · `e2e/game-ui-v2.spec.ts`

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
name shows the card. Rows are grouped under the turn divider, which stays. The text view is unchanged.
At 1440×900 the v2 panel shows at least fifteen events at once.

- Why: every event was a 50–80 px card that said the card name, the target and the player twice
  ("FOREST · Adam juega Forest"), with the same time on all of them, the sentence on a black box and
  the art at 25 % that could barely be seen; ten events filled the panel (review of 2026-10-27).
- Guard: `src/game/ActionFeedCard.test.tsx` · `e2e/game-ui-v2.spec.ts`

### PNL-4 · Chat messages are bubbles, mine on the right
Each chat message is a bubble under its sender's name (seat colour) and time. The own messages sit
on the right in a bubble tinted with the own seat colour; the others sit on the left. Card names in a
message stay hover links. The lobby switch is in the tab's title bar; the emoji picker, the input, the
send button and the quick reactions are unchanged.

- Why: every message was one line with every sender in the same blue, so the own messages and the
  speakers could not be told apart (review of 2026-10-27).
- Guard: `src/game/GameChat.test.tsx`

### PNL-5 · The deck tracker knows every card of the list, seen or not
The tracker resolves the mana cost, mana value, types and colours of every card in the deck list,
including the ones that have not been seen in the game yet, from the card's printing in the list
(through the cached card-data path, never a raw Scryfall request). A card is never counted as "other"
or shown with a 0 cost because it has not been seen. While that data is still loading the type odds
and the groups of PNL-6 say they are loading instead of showing numbers built from missing data, and a
card whose data cannot be found is counted as "no data" (named in the summary), never in a type.

- Why: the cost and type came only from cards seen on the table, so every unseen card had a "0" pip,
  no colour and counted as "other": a deck full of creatures showed creatures 0 %, spells 0 % and
  others 17 % (review of 2026-10-27).
- Guard: `src/game/deckTracker.test.ts` · `src/game/DeckTrackerPanel.test.tsx`

### PNL-6 · The deck tracker labels its counts, groups the cards by type and folds the drawn ones away
The summary says what each number is: the cards left to draw (large), "of M in your list", and the
library count the server reports. Under it, one bar splits the next draw into land, creature, instant
or sorcery, and other, with a four-column legend (percentage and count). Search stays; the order is a
four-way segmented control (cost, name, copies, odds). The cards still in the library are grouped as
creatures, spells, others and lands, each group with its count, ordered inside by the chosen order.
A row shows the name, "×N" only when more than one copy is left (remaining and initial in its
tooltip), the mana cost and the draw odds; the revealed top card keeps its badge and every row keeps
its hover preview. The cards with no copy left are folded into one "drawn" section at the end, closed
by default and showing how many; there is no hide-empty toggle and no struck-through row in the list.

- Why: "39 / 51 (58)" were three numbers without a label, the drawn cards stayed in the list struck
  through and took half of it, "1 / 1 · 1.7%" repeated on every single copy, and the tab used its own
  monospace, 9–10 px capitals and four boxed colours (review of 2026-10-27).
- Guard: `src/game/DeckTrackerPanel.test.tsx`

### PNL-7 · Commander damage keeps its matrix, with a one-line help, each column's commander and a threat bar
The v2 matrix stays as it is (rows receive, columns are the commander's owner, a bar per cell, the
own cell empty, the tones near and at lethal). The help above it is one line. Each column head shows
the owner (seat colour) and, under it, the name of their commander (both names for partners); the
tooltip stays. The biggest threat is a callout with a bar of the damage taken out of 21, in the
attacker's seat colour, and the numbers ("16 / 21").

- Why: the help took four permanent lines above the table, which commander each column meant was only
  in a tooltip, and the threat was a plain sentence (review of 2026-10-27).
- Guard: `src/game/CommanderSeatMatrix.test.tsx`

### PNL-8 · Each mechanic in play is a card that names its owner
In the v2 mechanics tab every mechanic is a card with an icon, its name and its owner as a chip in the
owner's seat colour. The Ring shows a four-step bar of its level ("level 3 of 4"), the Ring-bearer, and
its four abilities (the ones gained marked, the current one highlighted, the next one locked). A dungeon
shows its rooms as one row per depth, numbered, with the current room in gold and the visited ones
marked, and the current room's effect under the map. The table state (day or night, the monarch, the
initiative, the city's blessing, each player's speed) is a grid of two-column tiles, each naming the
player in their seat colour; speed has a four-step bar.

- Why: the sections were grey on grey with the owner in small grey text, the dungeon rooms were
  centred chips with no sense of depth, and the table state was a key-value list (review of 2026-10-27).
- Guard: `src/game/MechanicsOverview.test.tsx`

### PNL-9 · With no mechanic in play, the tab explains each one correctly
When no table mechanic is in play the mechanics tab (v2 and classic) says so and lists, one line each,
what the Ring tempting you, dungeons, day and night, the monarch, the initiative, the city's blessing
and speed do, each with its own text.

- Why: the empty state's glossary reused unrelated translation keys, so it read "Day / Night: Priority —
  respond to spells", "Monarch / Initiative: The Monarch" and "Dungeon: Dungeon active:", and its title
  appeared twice (review of 2026-10-27).
- Guard: `src/game/MechanicsGlossary.test.tsx` · `src/game/MechanicsTray.test.tsx`
