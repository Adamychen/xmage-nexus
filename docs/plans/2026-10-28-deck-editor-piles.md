# Deck editor with piles — implementation plan (2026-10-28)

Rules: `docs/specs/decks.md` DCK-1, DCK-3, DCK-5 … DCK-14. Design canvas: the review of 2026-10-28
(before board, interactive desktop and phone mockups, inventory). This file fixes the contracts the
work is split on, so pieces built in parallel fit together.

## Work split

| Wave | Piece | Owns (only these files) |
|---|---|---|
| 1 | A1 settings + strings | `src/state/slices/settings.ts`, `src/state/persistence.ts` (+test), `src/state/actions.ts`, `src/i18n/locales/*.ts`, new `src/decks/useStackLabels.ts` |
| 1 | A2 pile model | new `src/decks/stackPiles.ts` (+test), `src/decks/stackColumns.ts` (+test), `src/lobby/decks.ts` (one field), deck normalisation/storage if a field would be dropped |
| 1 | B `.dck` layout | `src/decks/parseDck.ts` (+test), the `.dck` exporter (+test), the import path into `DeckV2` |
| 2 | C stacks component | `src/decks/ArenaCardStacks.tsx/.css` (+test), new `src/decks/stackLayout.ts` (+test) |
| 2 | D card panel + numbers | new `src/decks/CardFocusPanel.tsx/.css`, new `src/decks/DeckNumbersPanel.tsx/.css` (+tests) |
| 2 | E top bar + toolbar | new `src/decks/DeckEditorTopBar.tsx/.css`, new `src/decks/DeckEditorToolbar.tsx/.css` (+tests) |
| 3 | F integration | `src/decks/DeckBuilder.tsx/.css` (+tests), `src/decks/DecksGallery.tsx`, removal of `DeckStacksEditor.*`, `ArenaDeckHeader`/`DeckBuilderFooter` if unused |
| 4 | G phone | phone CSS/markup of the editor, action sheet, "⋯" menu |
| 4 | H e2e | `web/e2e/*` for decks |

Every test that holds a rule starts its title with the rule id (`'DCK-6: …'`). When a rule's first
test lands, replace its `Guard: none yet (…)` line in `docs/specs/decks.md` with the test files
(relative to `web/`, joined by ` · `); `src/specCoverage.test.ts` checks it.

## Contracts

### Settings (A1)

Same pattern as `deckStacksScale` (own localStorage key, load/normalise/save in
`persistence.ts`, `settings.ts` slice field, save + cross-tab reload in `actions.ts`):

| Setting | Type | Default | Key |
|---|---|---|---|
| `deckEditorView` | `'piles' \| 'list'` | `'piles'` | `mage-web-deck-editor-view` |
| `deckStacksGroup` | `'type' \| 'cmc' \| 'color' \| 'rarity' \| 'free'` | `'type'` | `mage-web-deck-stacks-group` |
| `deckStacksSort` | `'cmc' \| 'name'` | `'cmc'` | `mage-web-deck-stacks-sort` |
| `deckStacksCopies` | `'separate' \| 'together'` | `'separate'` | `mage-web-deck-stacks-copies` |
| `deckEditorDrawer` | `boolean` | `true` | `mage-web-deck-editor-drawer` |

An unknown stored value normalises to the default.

### Pile model (A2) — `src/decks/stackPiles.ts`

```ts
export interface DeckPile { id: string; label: string }
/** `assign` maps deckCardKey(card) ("SET:NUM:Name") to a pile id. */
export interface DeckStackPiles { piles: DeckPile[]; assign: Record<string, string> }
```

`Deck` (in `src/lobby/decks.ts`, so `DeckV2` inherits it) gains `stackPiles?: DeckStackPiles`.
Pure helpers, each returning a new object: `seedStackPiles(cards, metaOf, typeLabels)` (one pile per
non-empty Type column, in Type order, labelled with the type label, every card assigned),
`addPile(sp, label) → { next, id }`, `renamePile(sp, id, label)`, `removePile(sp, id)` (only empty
piles; otherwise returns `sp` unchanged), `assignCard(sp, cardKey, pileId)`,
`pruneStackPiles(sp, cards)` (drops `assign` keys of cards no longer in the deck). Pile ids are
`p1`, `p2`, … (next free number).

### Columns (A2) — `src/decks/stackColumns.ts`

```ts
export type StackGroup = 'type' | 'cmc' | 'color' | 'rarity' | 'free'
export type StackSort = 'cmc' | 'name'
export interface StackLabels {
  type: Record<CardCategory, string>
  cmc: (n: number) => string            // n = 0..5, and 6 means "6+"
  lands: string
  color: Record<'W' | 'U' | 'B' | 'R' | 'G' | 'multi' | 'colorless', string>
  rarity: Record<'mythic' | 'rare' | 'uncommon' | 'common' | 'other', string>
  loading: string
  unsorted: string
  commander: string
}
export interface BuildStackOptions {
  group: StackGroup
  sort: StackSort
  labels: StackLabels
  keyPrefix?: string                    // 'sb:' for the sideboard, as today
  piles?: DeckStackPiles                // used by 'free'
  commanderKeys?: Set<string>           // deckCardKey of commander + partner
  singlePile?: { id: string; label: string } // 'free' in the sideboard: everything in one pile
}
export function buildStackColumns(cards: DeckCard[], metaOf: (c: DeckCard) => CardStripMeta | undefined, opts: BuildStackOptions): StackColumn[]
```

`StackColumn` (in `ArenaCardStacks.tsx`) gains `kind: 'group' | 'pile' | 'unsorted' | 'loading' | 'commander' | 'single'`;
`StackItem` gains `loading?: boolean`. Column ids: type → the category; cmc → `cmc-0` … `cmc-6`,
`lands`; color → `W` `U` `B` `R` `G` `multi` `colorless` `lands`; rarity → `mythic` `rare`
`uncommon` `common` `other`; free → the pile ids and `unsorted`; plus `commander` and `loading`.
Order: `commander` first, then `loading` (not in free), then the grouping's order. Empty columns are
dropped except free piles. A card with no meta is a loading item; in free it stays in its pile
(drawn as a placeholder) and only unassigned cards go to `unsorted`. Sort `cmc`: mana value then
name, except in the cmc grouping where it is type order then name; sort `name`: name. Colour: a
land (Type category `lands`) goes to `lands`; more than one colour is `multi`; none is
`colorless`. Rarity: `special`, `bonus` or unknown go to `other`. `buildTypeColumns` stays as a
wrapper (group `type`, sort `cmc`) for `DeckInspectorModal`.

### Strings (A1) — namespace `decks`, added to every locale

English and Spanish below; other locales get a proper translation of the English.

| Key | en | es |
|---|---|---|
| `editor_open` | Open | Abrir |
| `editor_view` | View | Vista |
| `editor_view_piles` | Piles | Pilas |
| `editor_view_list` | List | Lista |
| `editor_group` | Group | Agrupar |
| `group_type` | Type | Tipo |
| `group_cmc` | Mana value | CMC |
| `group_color` | Colour | Color |
| `group_rarity` | Rarity | Rareza |
| `group_free` | Free | Libre |
| `editor_copies` | Copies | Copias |
| `copies_separate` | Separate | Separadas |
| `copies_together` | Together | Juntas |
| `editor_sort` | Sort | Orden |
| `editor_add_cards` | Add cards | Añadir cartas |
| `editor_more` | More actions | Más acciones |
| `pile_cmc` | MV {n} | CMC {n} |
| `pile_cmc_max` | MV 6+ | CMC 6+ |
| `pile_lands` | Lands | Tierras |
| `color_W` | White | Blanco |
| `color_U` | Blue | Azul |
| `color_B` | Black | Negro |
| `color_R` | Red | Rojo |
| `color_G` | Green | Verde |
| `color_multi` | Multicolour | Multicolor |
| `color_colorless` | Colourless | Incoloro |
| `rarity_mythic` | Mythic | Mítica |
| `rarity_rare` | Rare | Rara |
| `rarity_uncommon` | Uncommon | Infrecuente |
| `rarity_common` | Common | Común |
| `rarity_other` | Other | Otra |
| `pile_commander` | Commander | Comandante |
| `pile_loading` | Loading… | Cargando… |
| `pile_unsorted` | Unsorted | Sin pila |
| `pile_new` | + New pile | + Nueva pila |
| `pile_default_name` | Pile {n} | Pila {n} |
| `pile_rename` | Rename pile | Renombrar pila |
| `pile_remove` | Remove pile | Quitar pila |
| `pile_drop_hint` | Drop a card here to make a pile | Suelta una carta aquí para crear una pila |
| `pile_empty` | Empty pile | Pila vacía |
| `side_band_toggle` | Fold or unfold the sideboard | Plegar o desplegar el banquillo |
| `focus_remove_all` | Remove all | Quitar todas |
| `focus_to_side` | To sideboard | Al banquillo |
| `focus_to_main` | To main | Al principal |
| `focus_printing` | Printing… | Impresión… |
| `focus_cover` | Cover | Portada |
| `focus_partner` | Partner | Compañero |
| `focus_move_to_pile` | Move to pile | Mover a la pila |
| `focus_new_pile` | + New | + Nueva |
| `focus_counts` | {main} in main · {side} in sideboard | {main} en principal · {side} en banquillo |
| `stats_avg_mv` | Average MV | CMC medio |
| `stats_creatures` | creatures | criaturas |
| `stats_other` | other | otros |
| `stats_lands` | lands | tierras |
| `stats_loading` | {n} loading | {n} cargando |
| `stats_symbols` | Mana symbols | Símbolos de maná |
| `stats_full` | Full curve and stats | Curva y estadísticas completas |
| `legal_in` | Legal in {format} | Legal en {format} |
| `cards_short` | {n} cards short | Faltan {n} cartas |
| `zone_main` | Main | Principal |
| `phone_curve` | Curve | Curva |

Sort reuses the existing `sort_cmc` / `sort_name` keys ("Mana cost" / "Name") of the catalogue's filter bar.

`useStackLabels()` (A1, `src/decks/useStackLabels.ts`) returns a memoised `StackLabels` built from
these keys and `useTypeLabels()`.

### Stacks component (C) — `ArenaCardStacks`

Props, all optional except `columns`: `copies` (`'separate' | 'together'`, default `'together'` so
`DeckInspectorModal` is unchanged), `selectedKey`, `onSelect(key)`, `onInc`, `onDec`, `onSwap`,
`onHover(card, meta, rect)`, `onLeave`, `zone` (`'main' | 'side'`, written into drag data),
`onDropCard(columnId, payload)`, `newPileColumn` (`{ label, hint }`: draws the trailing drop column),
`onRenamePile(id, label)`, `onRemovePile(id)`. Drag data: `application/json` with
`{ source: 'main' | 'sideboard', key }` (the format `DeckListPanel` and the catalogue already use)
and the catalogue's own payload for added cards. Layout positions come from `stackLayout.ts`
(`layoutStack(items, { copies, peek, copyOffset })` → `{ key, itemKey, top, z, front, copies }[]`
and the column height); sizes stay CSS variables driven by `--stack-scale` (DCK-1).

### Panels (D) and bars (E)

Presentational, no storage: they take the deck, counts, metas and callbacks as props.
`CardFocusPanel`: card (or null), meta, counts, zone, issue text, commander-format flag, piles (free
only) and callbacks for every DCK-9 action. `DeckNumbersPanel`: main cards, metaOf, format, basic
land callbacks (reuse `BasicLandAdder`), `onOpenInspector`, loading count. `DeckEditorTopBar`: the
DCK-5 top bar (takes over from `ArenaDeckHeader` + `DeckBuilderFooter`; reuse their pieces).
`DeckEditorToolbar`: drawer toggle, View, and in piles Group, Copies, Sort and `CardSizeSlider`.
