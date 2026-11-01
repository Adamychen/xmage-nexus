# Decks

Prefix: `DCK`

The deck screens: the gallery (`web/src/decks/DecksGallery.tsx`) and the deck editor
(`DeckBuilder.tsx`): its catalogue drawer (search grid and filter bar `ArenaFilterBar.tsx`,
suggestions), its two views of the deck (Piles, drawn with `ArenaCardStacks.tsx` from
`stackColumns.ts`, and List, the strips of `DeckListPanel.tsx`), the sideboard band and the card
panel. Until 2026-10-28 the piles lived in a separate screen, `DeckStacksEditor.tsx` (DCK-5).

### DCK-1 · The Piles view has a card size slider up to 200%
The Piles view has a "Card size" slider in the editor toolbar, the same control the catalogue shows
in its filter bar (label, range input, value as a percentage). It goes from 50% to 200% in steps of
10%, 100% by default (today's tile size). It scales the cards of the main deck columns: tile width,
the peek height of each stacked card and the column width grow and shrink together, so a stack
stays readable at every size. The sideboard band keeps its size. When the columns no longer fit,
the main area scrolls (both directions as needed) inside itself; the page never scrolls sideways and
the catalogue drawer, the card panel and the sideboard band keep their place. Clicking, Shift-clicking and the copy-count badge
behave the same at every size. The value (`deckStacksScale`) is a player setting kept across
sessions.

- Why: at the default size a 60-card deck's columns are small to read on a large screen, and the
  deck builder already let players choose a card size; the user asked for the same in the stacks
  view, up to 200% (2026-10-24).
- Guard: `src/decks/DeckEditorToolbar.test.tsx` · `src/state/persistence.test.ts` · `e2e/deck-editor-piles.spec.ts` · `src/decks/DeckBuilder.test.tsx`

### DCK-2 · Picking a deck file imports it and clears the picker, so the same file can be picked again
Importing a deck or restoring a backup from a file picker reads the file, applies it, and then
empties the picker. The picker is emptied even when the read fails, and the same file can be picked
again straight after. A failed read never surfaces as an unhandled error.

- Why: the report of 22 Oct 2026 (app 0.5.0): the handler read the input's `currentTarget` after
  `await`, when React has already cleared it, so every pick threw `TypeError: Cannot set properties
  of null` and the picker kept its value.
- Guard: `src/decks/DeckImportModal.test.tsx` · `src/decks/ImportDeckDialog.test.tsx` · `src/decks/DecksGallery.test.tsx`

### DCK-3 · The hover preview shows the whole card, the same in every deck screen
Hovering a card in the deck builder, the construct screen, the draft or the sideboard shows one
enlarged preview (`DeckHoverPreview`): the whole card, never cropped, up to 420 px wide and never
wider than half the window or taller than the window, with both faces side by side for a
double-faced card. It opens beside the hovered card, on the side with room, and stays inside the
window. Its styles live only in `DeckHoverPreview.css`. One exception: in the editor's Piles view,
hovering a card of the deck or the sideboard shows it in the card panel (DCK-10) instead, so the
floating preview does not cover the piles; it still opens for the catalogue and the List view.

- Why: each screen kept its own copy of the preview markup and of the global
  `.arena-floating-preview` rules. When the deck builder preview grew to 420 px (`a594f15186`),
  the draft screen's `img { max-width: 255px }` still applied, so every deck builder preview showed
  a 255 px strip of the card cropped by `object-fit: cover` inside a 420 px frame. The position also
  assumed a 255 px preview, so the larger one could cover the hovered card or leave the window.
- Guard: `src/decks/DeckHoverPreview.test.tsx` · `src/decks/hoverPreviewCss.test.ts` · `src/decks/DeckBuilder.test.tsx`

### DCK-4 · On a touch screen the deck strip actions are always shown
Each card in the deck strip has its actions (move, add, remove, print, favourite, commander) shown without
a hover on a screen that has no hover. On a pointer device they stay hidden until hover or keyboard focus,
as before.

- Why: the actions only appeared on hover or focus-within, so a phone player could not reach them (the
  review of 2026-10-25). Offering an alternative to a hover gesture is the rule in ACC-9.
- Guard: `e2e/decks-touch.spec.ts`

### DCK-5 · One deck editor with two views, Piles and List
The gallery opens a deck with one button, "Open" (it replaces "Edit" and "Stacks editor"); the
separate stacks screen is gone. The editor has a top bar and a toolbar. The top bar holds, left to
right: back to My decks, the cover thumbnail, the editable name, and under it the format selector,
the legality chip ("Legal in <format>" or what is wrong; clicking it opens today's issue list), the
main and sideboard counts and the save state (saving, saved, failed with retry); then Import,
Export, Sample hand, Equip and Done. The toolbar holds the catalogue toggle (DCK-12), View
(Piles | List), and in Piles view Group, Copies, Sort and Card size (DCK-1, DCK-6, DCK-8). List view
is today's strip list with every strip action; Piles view is DCK-6 to DCK-11. Everything the old
builder offered stays reachable in both views: server and XMage format issue banners with repair,
commander and partner, printings, cover, curve, basic lands, the deck inspector, suggestions,
dropping a deck file. The view is a player setting (`deckEditorView`, default Piles) kept across
sessions.

- Why: the review of 2026-10-28 found two screens for one job with different features (the stacks
  screen had no curve, validation, commander, printings or cover; the builder had no piles), and a
  builder that gave the catalogue 70% of the width while the deck showed one card; the user asked
  to implement the single editor of that review.
- Guard: `src/decks/DeckEditorTopBar.test.tsx` · `src/decks/DeckEditorToolbar.test.tsx` · `src/state/persistence.test.ts` · `src/decks/DecksGallery.test.tsx` · `src/decks/DeckBuilder.test.tsx` · `e2e/deck-editor-piles.spec.ts`

### DCK-6 · Piles group by type, mana value, colour, rarity or freely
In Piles view, Group picks how the main deck splits into piles: Type (creatures, planeswalkers,
instants, sorceries, artifacts, enchantments, lands, other, as today), Mana value (one pile per
value 0 to 5, then 6+, with lands in their own last pile), Colour (white, blue, black, red, green,
multicolour, colourless, then lands), Rarity (mythic, rare, uncommon, common, then any other) or
Free (DCK-7). A pile with no cards is not drawn, except in Free. Sort orders the cards inside a
pile: by mana value then name (default) or by name; in Mana value grouping the mana value sort
orders by type, then name. The sideboard band is grouped the same way, except in Free, where it is
a single pile. In a commander format the commander and partner are a fixed first pile,
"Commander", in every grouping. Group and Sort are player settings (`deckStacksGroup`, default
Type; `deckStacksSort`, default mana value) kept across sessions.

- Why: player feedback of 2026-10-28 ("it needs free stacking, ability to stack by type, cmc, and
  free"); XMage desktop's deck editor (`DragCardGrid`) offers the same choice (No Sort, Card Type,
  Mana Value, Color, Rarity…), so players coming from it expect it.
- Guard: `src/state/persistence.test.ts` · `src/decks/stackColumns.test.ts` · `src/decks/DeckEditorToolbar.test.tsx` · `src/decks/DeckBuilder.test.tsx` · `e2e/deck-editor-piles.spec.ts`

### DCK-7 · Free piles belong to the deck and travel in its .dck file
In Free grouping the main deck is drawn as the deck's own named piles, in the player's order.
Dragging a card moves the one copy that was dragged, so the copies of a card can sit in different
piles (each pile shows the copies it holds); the card panel's "Move to pile" moves every copy of the
card at once. Dropping on the trailing "+ New pile" column creates "Pile N" holding what was
dropped. A pile's name is edited in place from its header, and an empty
pile shows a remove button. A card that has no pile yet (just added, or the deck has piles from
before it) waits in a leading "Unsorted" pile that is drawn only while it holds cards. The first
time a deck is shown in Free, its piles are seeded from the Type grouping, once every card's
data has arrived; if the player makes a pile before that, their piles are kept and nothing is
seeded. The piles are saved with
the deck (`DeckV2.stackPiles`). Exporting to .dck writes XMage's layout lines: `LAYOUT MAIN:` with
one row and one column per pile, settings `(NONE,false,50)` and one `[SET:NUMBER]` per copy, and
`LAYOUT SIDEBOARD:` with the sideboard as one pile. When a card of the main deck or the sideboard has no
printing (no set code, or no card number, or number 0), the layout lines are left out of the export, so XMage never reports a count
mismatch; the piles stay in the app. Importing a .dck whose `LAYOUT MAIN:` has sort
`NONE` rebuilds the piles from it (rows read top to bottom, columns left to right, empty stacks
skipped, named "Pile 1", "Pile 2"…); any other layout line is ignored, as before.

- Why: free stacking is only worth arranging if it is kept; XMage desktop stores its arrangement in
  the same `LAYOUT` lines (`XmageDeckExporter`, `DckDeckImporter`), so a deck keeps its piles
  between both clients, and `parseDck.ts` used to drop those lines.
- Guard: `src/decks/parseDck.test.ts` · `src/decks/DeckImportModal.test.tsx` · `src/decks/useDeckMutations.test.ts` · `src/decks/stackColumns.test.ts` · `src/decks/stackPiles.test.ts` · `src/decks/ArenaCardStacks.test.tsx` · `src/decks/DeckBuilder.test.tsx` · `e2e/deck-editor-piles.spec.ts`

### DCK-8 · Copies are drawn one by one or together
Copies picks how repeated cards stack: Separate (default) draws every copy as its own card, each a
few pixels under the previous copy of the same card, while different cards step down by the height
of the title strip, so a pile's height shows how many cards it holds; Together draws one card per
distinct card. In both, the front copy of a card with more than one copy shows "×N". Copies is a
player setting (`deckStacksCopies`) kept across sessions.

- Why: the review of 2026-10-28: twenty Mountains were one tile with "20x", so a pile's height
  said nothing about its weight; XMage desktop draws every copy.
- Guard: `src/state/persistence.test.ts` · `src/decks/DeckEditorToolbar.test.tsx` · `src/decks/ArenaCardStacks.test.tsx` · `src/decks/stackLayout.test.ts` · `src/decks/DeckBuilder.test.tsx` · `e2e/deck-editor-piles.spec.ts`

### DCK-9 · Cards move by dragging, and every drag has a click, key and touch equivalent
In Piles view a card can be dragged: between piles in Free (DCK-7), from the main deck to the
sideboard band and back (one copy), from the catalogue onto a pile or the band (adds one copy
there) and from the deck onto the catalogue (removes one copy). Clicking a card selects it (a gold
ring) and shows it in the card panel (DCK-10), whose buttons do the rest: −1, +1, Remove all,
To sideboard or To main, Printing…, Cover, Commander and Partner in commander formats, and in Free,
Move to pile (each pile, plus New). On a focused card, Enter or Space selects, "-" or Delete removes
one copy, "+" adds one, "S" moves one copy to the other zone. Right-click still adds one and
Shift+click still moves one copy to the other zone. On a touch screen a tap selects and the panel
(the action sheet on a phone, DCK-14) is how a card is changed.

- Why: the review of 2026-10-28: the stacks screen's actions (click −1, right-click +1,
  Shift+click move) lived only in a hint line and nothing could be dragged. Selecting first gives
  every card action one visible place, and keyboard and touch get the same reach as a drag (ACC-9).
- Guard: `src/decks/CardFocusPanel.test.tsx` · `src/decks/ArenaCardStacks.test.tsx` · `src/decks/DeckBuilder.test.tsx` · `e2e/deck-editor-piles.spec.ts`

### DCK-10 · The card panel shows one card and the deck's numbers
The editor's right panel shows, in Piles view, the selected card, else the last hovered card, else
the deck's cover: the whole card, its name, type line, rarity, mana value and its counts in the
main deck and the sideboard, then the actions of DCK-9 and any issue the card has (not implemented
in XMage, not legal). Under them, in both views, the deck's numbers stay visible: the mana curve of
the main deck's non-land cards (0 to 6+), creatures, other spells and lands, the average mana
value, the share of each colour's mana symbols, the basic lands of today's adder (± per colour and
the suggested basics) and a button that opens the deck inspector. In List view the panel shows only
the numbers.

- Why: the review of 2026-10-28: the curve, pips and basic lands pushed the deck list off the
  screen in the old builder, and the stacks screen showed none of them.
- Guard: `src/decks/CardFocusPanel.test.tsx` · `src/decks/DeckNumbersPanel.test.tsx` · `src/decks/DeckBuilder.test.tsx`

### DCK-11 · A card whose data is still loading waits in a Loading pile
Until a card's Scryfall data arrives it is drawn as a card-shaped placeholder with its name, in a
"Loading…" pile that comes first in every grouping except Free, where the card keeps its own pile
(or "Unsorted") and waits there as a placeholder; it never goes to "Other", which holds only cards whose type
line is known and fits no other pile. A card counts as loaded once its type line is known. Deck
cards are fetched ahead of catalogue images, in the order they are listed. A failed fetch is retried
for about a minute (after 1, 10, 20 and 30 s), which covers a Scryfall rate-limit window. A rejected
Scryfall request (a TypeError: the browser reports a throttled answer as a network error) opens a pause
that holds background requests only: one window at a time, 2 s, doubling to 30 s while requests keep
failing, and reset by any response. Urgent requests are not held by it. The lookups of an import or a
resolve are urgent too, because the user is waiting for them, and a background request that an urgent
caller asks for is promoted to urgent. A card whose data still cannot be fetched stays in the Loading
pile and is tried again the next time the deck changes. The numbers of DCK-10 count only loaded cards
and say how many are still loading.

- Why: the review of 2026-10-28: while the Scryfall queue loaded, 36 of 60 cards sat in "Other"
  without images and the curve and colour share were wrong, which read as a classification bug.
  The cause: deck metadata waited at the back of the Scryfall queue behind every catalogue tile, and
  a failed fetch was dropped without a retry. Urgent requests were also queued last-in first-out, so
  the first cards of a deck were sent last and fell into a Scryfall 429 window; Scryfall's 429 has no
  CORS header, so the browser reports it as a TypeError and the queue never paused, and three quick
  retries (about 7 s) ended before the window (25 to 60 s) closed. The first pause that fixed this
  re-armed on every failure, so an unreachable Scryfall serialised the whole queue at one request per
  2 s and held the import's own lookups: the CI run of 2026-10-28 failed the import wizard's
  5 s budget after three unrouted printing lookups (see `docs/lessons.md`).
- Guard: `src/decks/stackColumns.test.ts` · `src/decks/DeckNumbersPanel.test.tsx` · `src/decks/ArenaCardStacks.test.tsx` · `src/decks/DeckBuilder.test.tsx` · `src/decks/useDeckMetadata.test.ts` · `src/decks/importResolve.test.ts` · `src/cards/scryfallClient.test.ts` · `src/decks/useDeckMutations.edits.test.ts`

### DCK-12 · The catalogue is a drawer the deck can take over
The catalogue (Search and Suggestions tabs, unchanged inside) is a drawer on the left that the
toolbar's "Add cards" button opens and closes; closed, its width goes to the deck. Whether it is
open is a player setting (`deckEditorDrawer`, default open) kept across sessions. Dragging a deck
card onto it removes one copy (DCK-9).

- Why: the review of 2026-10-28: the catalogue took about 70% of the width at all times, listing
  the whole card pool alphabetically, while the deck being built showed one card.
- Guard: `src/state/persistence.test.ts` · `src/decks/DeckEditorToolbar.test.tsx` · `src/decks/DeckBuilder.test.tsx` · `e2e/deck-editor-piles.spec.ts`

### DCK-13 · The sideboard is a band under the main deck
In Piles view the sideboard is a band under the main piles, drawn with the same piles and copies
(DCK-6, DCK-8) at its own size (DCK-1). It is capped at 38% of the editor's height and scrolls
inside that cap, so the main piles are always the larger region. Its header shows the count against
the format's limit, in a warning colour above it, and a button that folds the band to its header. A folded band still takes drops on its header, and
its count updates.
Cards are dragged in and out of it (DCK-9).

- Why: the old stacks screen drew the sideboard as a 250 px column of names that did not stack
  like the deck, and left half the screen empty (review of 2026-10-28).
  At 1440×900 a 60+15 deck gave the band more height than the main piles (about 290 px); the cap is
  what prevents that.
- Guard: `src/decks/DeckBuilder.test.tsx` · `e2e/deck-editor-piles.spec.ts`

### DCK-14 · On a phone the editor shows the deck first
Below 700 px of width the editor stacks: a top bar with back, the name, the format with counts and
legality, and a "⋯" menu (Import, Export, Sample hand, Equip, card language); a Main | Sideboard
switch; the Group choices as a row of chips that scrolls sideways; the piles, which scroll
sideways; and a bottom bar with "+ Add cards", which opens the catalogue as a full-screen sheet, and
"Curve", which opens the numbers. Tapping a card opens an action sheet with the card, its counts and
−1, +1, To sideboard or To main, and Move to pile in Free. The app's bottom navigation and the
credits never cover the piles or the sheet. The bottom bar keeps the height of the credits footer
clear above it (measured, not assumed). The Piles | List choice is one more item of the "⋯" menu,
so List stays reachable on a phone: the List view replaces the piles, the switch and the chips.

- Why: the review of 2026-10-28: on a 390 px phone the stacks screen showed only the search panel,
  and the footer and credits covered the sideboard.
- Guard: `e2e/deck-editor-phone.spec.ts` · `src/decks/DeckBuilder.test.tsx`

### DCK-15 · Piles also group by colour identity and by EDH power level
Group also offers Colour identity (white, blue, black, red, green, multicolour, colourless, by the
card's colour identity, lands included, so a Commander deck sorts by what its commander allows) and
EDH power (one pile per level, labelled "EDH: n", lowest first). The power level is the same
heuristic XMage desktop uses (`CardViewEDHPowerLevelComparator`): the highest of the points its
rules text, keywords, types and name earn, ported rule for rule (mana value plays no part). A card whose data is still loading waits in the
Loading pile (DCK-11).

- Why: XMage desktop's deck editor groups by Color Identity and EDH Power Level as well
  (`DragCardGrid.Sort`); the first version of the piles left both out (2026-10-28),
  and the user asked to implement what was missing.
- Guard: `src/decks/edhPowerLevel.test.ts` · `src/decks/stackColumns.test.ts` · `src/state/persistence.test.ts` · `src/decks/DeckEditorToolbar.test.tsx`

### DCK-16 · Creatures can get their own row of piles
"Separate creatures" (a toolbar toggle, off by default like XMage desktop) draws the main deck in two
rows: the creatures in the first row and every other card in the second, both rows grouped the same
way. It applies to every grouping except Type (which already gives creatures their own pile) and Free.
It is a player setting (`deckStacksSeparateCreatures`) kept across sessions. The sideboard band
stays one row.

- Why: XMage desktop's "Puts creatures in separate first row" (`DragCardGrid`, the
  `separateCreatures` flag of its `.dck` layout settings); the user asked to implement what the
  first version left out (2026-10-28).
- Guard: `src/state/persistence.test.ts` · `src/decks/stackColumns.test.ts` · `src/decks/DeckEditorToolbar.test.tsx` · `src/decks/DeckBuilder.test.tsx`

### DCK-18 · A colour chip shows cards of that colour and the lands that make it
In the editor's search, picking one or more colour chips (white, blue, black, red, green) shows cards
whose colours are all among the picked ones, and lands whose colour identity is among them and not
empty, that is, lands that make one of the picked colours. Colourless cards and lands that make none of
those colours are left out; the colourless chip shows them on its own. Suggestions filter the same way
by colour identity.

- Why: picking only red listed colourless lands that make no red (Abandoned Air Temple, Academy Ruins)
  and colourless artifacts first, because a colourless card's colours are always "within" any pick
  (report of 2026-10-31). MTG Arena's colour filter keeps colourless cards behind their own chip too.
- Guard: `src/decks/filterQuery.test.ts` · `src/decks/filterMatch.test.ts`
