# Rendered cards (issue #12: legible card text)

Cards are drawn from `CardView` data instead of a printed-card image, so the rules text is real text
that stays sharp and legible at any size. Opt-in setting; the image style stays the default.

## Principle

`cardLayout(card)` (pure, `web/src/cards/rendered/cardLayout.ts`) classifies a `CardView` into a layout
kind; `RenderedCard` draws it. Everything sizes from the container width (`cqw`), so a single size slider
scales the whole card. The text comes from the engine, so it reflects the live state (modified P/T,
colours, types, counters), which a printed image cannot.

## Wire facts the design depends on (read from `fixtures/recorded/*.json`)

- `manaCostLeftStr` / `manaCostRightStr` are arrays of symbols (`["{2}","{R}"]`), not one string.
- `rules` entries carry HTML (`<i>`) and entities, and `{this}`; `FormattedText` already cleans them.
- `loyalty`, `defense` and `power` are present as empty strings on every card: classify on `cardTypes`
  and `subTypes`, never on field presence.
- `frameColor` is all-false in practice; the colour comes from `color`.
- Adventure and split cards arrive as `isSplitCard` with `leftSplit*` / `rightSplit*`; the right half's
  `rightSplitTypeLine` carries `Adventure`.
- `mageObjectType` distinguishes `CARD`, `PERMANENT`, `EMBLEM` and the rest; dungeons have no `cardTypes`.

## Layout kinds

standard · planeswalker (one row per loyalty ability) · battle · saga (one row per chapter) ·
class / room / case · split (two halves) · adventure · transform / MDFC (`secondCardFace`, flip button) ·
token · emblem · dungeon · ability (stack) · face-down · hidden (card back) · generic fallback.

## Setting

`cardRender`: `image` (default) | `rendered` | `auto` (rendered only where no image exists).
Applies to the hand column (with a size slider), the inspector and hover preview, the stack and the piles.
The battlefield keeps its tiles until a later phase.

## Tests

`cardLayout` unit tests over synthetic and recorded cards; one gallery entry per layout; an e2e spec that
asserts the contract "no rules text is clipped" (the text box overflows by scrolling, never by cutting),
and that the guard can fail. No pixel budgets.

## Order

1. `cardLayout` + standard template + text fit + gallery.
2. Planeswalker, saga, split, adventure, transform.
3. Class, room, leveler, token, ability, face-down.
4. Setting + hand column with slider.
5. Stack, piles and inspector.
