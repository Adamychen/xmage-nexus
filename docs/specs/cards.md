# Looking at a card

Prefix: `CRD`

The card inspector: the read-only panel a right click on a card opens during a
game (`web/src/board/CardInspector.tsx`). It shows the card large next to what the printed card
cannot tell: its state on the battlefield and its text in the player's card language. The hover
preview is a different, lighter surface and is not covered here.

### CRD-1 · The inspector shows the battlefield state the printed card cannot
For a permanent on the battlefield, an "On the battlefield" section lists what differs from the
printed card: power/toughness when an effect changed them (in green when above the printed value,
red when below, with the printed value under it), damage marked this turn with the toughness left,
loyalty when it is not the starting loyalty, defense when it is not the starting defense, every
counter with its count, and the statuses tapped, summoning sick, phased out, token and copy. What it
is attached to and what is attached to it are buttons that open that permanent in the inspector.
Controller and owner close the text. Values the printed card already shows (an unmodified 1/1, a
planeswalker at its starting loyalty) are left out, and a card that is not on the battlefield has no
such section. The section reads the live game state, so it follows the game while the inspector is
open.

- Why: the first inspector only repeated the printed card, the one thing the player could already
  read from the large image. Leaving out unchanged values follows the board's P/T badge, and keeps
  the rules text above the fold at 1280 × 720, where the 70% cap of DLG-10 leaves about 450 px.
- Guard: `src/board/cardInspectorModel.test.ts` · `e2e/card-inspector.spec.ts`

### CRD-2 · Both faces can be shown with a pointer, a key or a tap
A card with a second face (transforming, modal double-faced, or one with an alternate face) shows a
Front / Back switch above its name. The face the permanent shows on the battlefield carries a dot.
Shift or F still flips (KEY-9). The battlefield section belongs to the face in play and is hidden
while the other face is shown.

- Why: the face could only be flipped from the keyboard, so on a phone or tablet the back face of a
  card could not be read at all, and the hint that named the keys was not even on screen there.
- Guard: `e2e/card-inspector.spec.ts`

### CRD-3 · Side by side up to 70% of the screen, a bottom sheet at phone width
On a wide screen the card and a fixed-width text column sit side by side, the panel as wide as its
content and as tall as DLG-10 allows; the text column scrolls between a fixed header and a footer,
and fades at the bottom while there is more to read. At 760 px or narrower the inspector is a sheet
rising from the bottom edge: the card on top, the text under it, the whole sheet scrolling, and the
footer action pinned to the bottom, 44 px tall. No label in it is clipped.

- Why: the panel grew to `min(1120px, 96vw)` around a card that did not fill it (about 150 px of
  empty space on each side), the rules box stretched to the bottom as an empty block, the ✕ sat on the
  mana cost, the "Custom art" button was a 24 × 24 icon button with its label cut to "magen", and at
  phone width the card overflowed the top of the panel under the name.
- Guard: `e2e/card-inspector.spec.ts`

### CRD-4 · The rules text reads as abilities
Each ability is its own paragraph. A planeswalker's loyalty abilities are rows whose cost wears the
printed shield, the same one the activation dialog draws: pointing up for a plus in green, down for
a minus in red, flat for a zero. A cost with no number (an X) keeps a plain slot. An ability the
current loyalty cannot pay for is dimmed. The keyword abilities the card has are explained under the
rules, with the same glossary the hover preview uses.

- Why: the text was one block with the loyalty costs as plain "+2:" prefixes and no space between
  abilities, and a new player had no way to learn what a keyword means without leaving the game.
  The costs were then drawn as a flat badge of their own invention while the dialog that activates
  the very same ability drew the printed shield, so the player asked for the icons he knew
  (28-nov-2026).
- Guard: `src/board/cardInspectorModel.test.ts` · `e2e/card-inspector.spec.ts`

### CRD-5 · The header names the card the way a player reads it
Under the name and mana cost come the type line, the rarity (with its color) and the printing (set
code and collector number). With no translated text the type line is built from the card's
supertypes, types and subtypes ("Legendary Planeswalker — Jace"), never the engine's raw enum
("CREATURE"). The glow behind the card takes its color.

- Why: without a translated text the type line showed `CREATURE` with no subtypes, and the set and
  rarity, which the client already receives, were nowhere.
- Guard: `src/board/cardInspectorModel.test.ts`

### CRD-6 · Cards are shown in the language the card picker shows, never the interface's
Card names, images and texts follow the card language picker alone. Until the player picks one, the
picker shows English and cards are English; the interface language never changes the card language, so
an English card language with a Spanish interface shows English cards.

- Why: the effective card language treated English as "not chosen" and fell back to the interface
  language, so a Spanish interface showed Spanish card names while the picker said English (report of
  2026-10-31, after importing a deck).
- Guard: `src/cards/cardLanguage.test.ts`

### CRD-7 · Engine text is decoded before it is read, semicolon or not
Whatever the engine writes in a card's text reaches the player as text, never as markup: HTML tags
are stripped, object hashes dropped and named entities decoded. The entities XMage writes without
their closing semicolon are decoded too (`Modes.java` writes `&bull ` in front of each mode of a
modal permanent), and a word that merely starts like one is left alone.

- Why: a modal enchantment's text read "&bull Mardu — …" in the inspector, because the decoder only
  knew the well-formed `&bull;` (user report, 23-nov-2026).
- Guard: `src/game/FormattedText.test.tsx`

### CRD-8 · A keyword chip reads in one language, qualities included
A keyword drawn from a card's text carries the parameter the engine wrote: protection names its
qualities, ward its cost, toxic its number. The chip and its summary read in the interface's
language whole, so every quality of the parameter is translated, not only the first: a colour, a
card type, "everything" and the conjunction between them. A list may be written with commas or by
repeating the preposition ("black and from green"), and either way it is read as a list. A quality
with no translation of its own, a creature type or a number, is left exactly as the engine wrote it.

- Why: Sword of Feast and Famine granted "protección contra Black and from green" in Spanish,
  because the whole tail of the line was taken as one name and dropped into the template untouched
  (user report, 25-nov-2026).
- Guard: `src/data/keywordI18n.test.ts`


### CRD-9 · The art key can be read on screen when a printing looks wrong
With `?artdebug=1` in the URL, every card drawn carries a caption with the key its art was resolved
with and the printing the server sent for it, on the board and on the stack alike. It is off unless
the URL asks for it.

- Why: a player saw his own Reconnaissance, the Secret Lair printing on the battlefield, drawn on
  the stack as an older one (28-nov-2026). Both places resolve art through the same function, from
  the same `SET/number`, and both apply the player's art preference and uploaded images, so the
  difference has to be in what each one is given; a screenshot of the art cannot tell which. No
  recorded frame holds a permanent spell on the stack, which is the shape this happened in, so
  there was nothing to read it from either. The caption answers it from a screenshot of a real
  game, and the same caption answers the next question of this kind.
- Guard: `src/cards/artDebug.test.ts`

### CRD-10 · A card is drawn as the printing it has on the table
The client remembers, from every view it receives, the printing each card on the table came with,
by its id and by its name. A view that arrives without one, which is how a triggered ability
reaches the stack, is drawn with the printing its source has on the table instead of by name
alone. Face-down cards and tokens teach nothing, and a view that carries its own printing keeps
it.

- Why: a player had the Secret Lair printing of his card on the battlefield and the trigger of
  that same card showed an older frame on the stack; with `?artdebug=1` (CRD-9) the stack read
  `named:The Warring Triad · -/0` while the battlefield read `FIC/193`, so the engine had sent the
  ability's source with no printing and the name alone fetched whatever Scryfall answers with
  (28-nov-2026). The table is the authority: the card is right there, with its printing.
- Guard: `src/cards/seenPrints.test.ts`
