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
Each ability is its own paragraph. A planeswalker's loyalty abilities are rows with the cost as a
badge (light for +, grey for 0, dark for −); an ability the current loyalty cannot pay for is dimmed.
The keyword abilities the card has are explained under the rules, with the same glossary the hover
preview uses.

- Why: the text was one block with the loyalty costs as plain "+2:" prefixes and no space between
  abilities, and a new player had no way to learn what a keyword means without leaving the game.
- Guard: `src/board/cardInspectorModel.test.ts` · `e2e/card-inspector.spec.ts`

### CRD-5 · The header names the card the way a player reads it
Under the name and mana cost come the type line, the rarity (with its color) and the printing (set
code and collector number). With no translated text the type line is built from the card's
supertypes, types and subtypes ("Legendary Planeswalker — Jace"), never the engine's raw enum
("CREATURE"). The glow behind the card takes its color.

- Why: without a translated text the type line showed `CREATURE` with no subtypes, and the set and
  rarity, which the client already receives, were nowhere.
- Guard: `src/board/cardInspectorModel.test.ts`
