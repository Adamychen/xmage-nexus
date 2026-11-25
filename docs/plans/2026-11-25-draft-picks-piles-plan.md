# Draft picks as Arena piles — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the draft's flat picks grid with the deck editor's `ArenaCardStacks`: a Deck zone in
mana-value piles and a Sideboard band, where the Sideboard is the existing hidden-picks set.

**Architecture:** One small option on `buildStackColumns` (`keyOf`) lets every pick be keyed by its
card id. A pure module `web/src/game/draftPickStacks.ts` turns picks + `hiddenIds` into the two
zones' columns. `DraftScreen.tsx` renders them with `ArenaCardStacks` and maps swap/drag to
add/remove on `hiddenIds`, which is already sent with every `sendCardPick`.

**Tech Stack:** React 19 + TypeScript, vitest + Testing Library (jsdom), Playwright (fake backend).

**Spec:** `docs/plans/2026-11-25-draft-picks-piles-design.md`

## Global Constraints

- English only in code, tests, docs; translations only in `web/src/i18n/locales/*` (all 9 locales).
- No code comments. Do not commit (AGENTS.md: only on explicit request).
- No fixed pixel budget for the band's height (AGENTS.md "pixel budget" rule); assert the contract.
- Behaviour rule goes in `docs/specs/tournaments.md` as **TRN-21**; tests carrying it must have
  `TRN-21` in their title (`web/src/specCoverage.test.ts`).
- Keep the server semantics: hidden picks = sideboard (`DraftPlayer.prepareDeck`); `sendCardPick`'s
  third argument stays the hidden ids array (or `undefined` when empty).

## Review Focus

1. Two picks of the same printing (two identical commons): both must render as separate cards and
   move independently → test in Task 2.
2. Picks whose Scryfall data has not arrived: they sit in the "Loading…" pile, not lost → Task 2.
3. A pick dragged onto the zone it already belongs to: no-op, no duplicate in `hiddenIds` → Task 3.
4. Reload / new draft (`draftId` change) clears the sideboard exactly as hidden ids are cleared today
   → covered by the existing reset effect; Task 3 test asserts the band is empty after `draftId` changes.
5. Many picks (45 at the end of pack 3): the band scrolls, no pile is clipped → Task 4 e2e.

---

### Task 1: `keyOf` option for `buildStackColumns`

**Files:**
- Modify: `web/src/decks/stackColumns.ts` (`BuildStackOptions`, the `key` line in `buildStackColumns`)
- Test: `web/src/decks/stackColumns.test.ts`

**Interfaces:**
- Produces: `BuildStackOptions.keyOf?: (card: DeckCard) => string` — when set, an item's key is
  `keyPrefix + keyOf(card)` instead of `keyPrefix + deckCardKey(card)`.

- [ ] **Step 1: Failing test** `it('keyOf overrides the item key so equal printings stay distinct')`:
  two `DeckCard`s with identical `cardName/setCode/cardNumber`, amount 1, `keyOf` returning `'p-1'` /
  `'p-2'` (e.g. via a `WeakMap`), `group: 'cmc'`, loaded meta `{ typeLine: 'Creature', cmc: 2 }`.
  Assert the `cmc-2` column has items with keys `['p-1', 'p-2']`.
- [ ] **Step 2:** `npx vitest run src/decks/stackColumns.test.ts` → FAIL (keys equal).
- [ ] **Step 3:** Add the option; default unchanged.
- [ ] **Step 4:** Same command → PASS; existing tests still pass.

### Task 2: `draftPickStacks.ts`

**Files:**
- Create: `web/src/game/draftPickStacks.ts`
- Test: `web/src/game/draftPickStacks.test.ts`

**Interfaces:**
- Consumes: Task 1 `keyOf`; `StackLabels` from `useStackLabels()`; `CardStripMeta`.
- Produces:
  ```ts
  export interface DraftPickZones { deck: StackColumn[]; side: StackColumn[] }
  export function buildDraftPickZones(
    picks: SimpleCardView[],
    hiddenIds: ReadonlySet<string>,
    metaOf: (pick: SimpleCardView) => CardStripMeta | undefined,
    labels: StackLabels,
    sideLabel: string,
  ): DraftPickZones
  ```
  Each pick becomes a `DeckCard` (`cardName` = name or meta name, `setCode`, `cardNumber`, amount 1)
  keyed by `pick.id`. Deck = non-hidden picks, `group: 'cmc'`, `sort: 'cmc'`. Side = hidden picks,
  `group: 'free'`, `singlePile: { id: 'sideboard', label: sideLabel }`, no `keyPrefix` (keys are
  pick ids in both zones). An empty zone yields `[]`.

- [ ] **Step 1: Failing tests** (titles prefixed `TRN-21:`):
  - `splits picks into mana-value piles with lands last and hidden picks in the sideboard` — picks
    p-1 (cmc 1), p-2 (cmc 3), p-3 (Land), p-4 (cmc 2, hidden). Expect deck column ids
    `['cmc-1', 'cmc-3', 'lands']`, side `[{ id: 'sideboard', items: [key 'p-4'] }]`.
  - `keeps two picks of the same printing as two cards` — two picks with equal set/number/name →
    deck items keys `['a', 'b']`.
  - `puts picks without data in the Loading pile` — `metaOf` returns `undefined` → one column of
    kind `'loading'` holding the pick.
- [ ] **Step 2:** `npx vitest run src/game/draftPickStacks.test.ts` → FAIL (module missing).
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Same command → PASS.

### Task 3: `DraftScreen` renders the zones; rule TRN-21

**Files:**
- Modify: `web/src/game/DraftScreen.tsx` (picks area, `handlePick` fly target, remove per-pick 👁)
- Modify: `web/src/game/DraftScreen.css` (`.draft-picks-*` rules)
- Modify: `web/src/i18n/locales/*.ts` (9 files)
- Modify: `docs/specs/tournaments.md` (new TRN-21 after TRN-20)
- Test: `web/src/game/DraftScreen.test.tsx`

**Interfaces:**
- Consumes: Task 2 `buildDraftPickZones`; `ArenaCardStacks` (`zone`, `copies='separate'`,
  `selectedKey`, `onSwap`, `onHover`, `onLeave`, `onDropCard`); `useStackLabels()`.
- Produces (DOM contract used by Task 4): container `data-testid="draft-picks"` wraps the Deck zone,
  `data-testid="draft-sideboard"` wraps the band (always rendered, with a hint when empty and a drop
  region); pick cards are `.arena-stack-card[data-front="true"][data-card-key="<pick id>"]`; the
  newest pick (`pickAck.id`) is the stacks' `selectedKey` (`.is-selected` ring).

Behaviour:
- `onSwap(key)`: toggles `key` in `hiddenIds` (Deck → Sideboard, Sideboard → Deck). Shift+click and
  `S` come from `ArenaCardStacks` for free.
- Drop: the payload JSON (`application/json`, `{ source: 'main' | 'sideboard', key }`) dropped on the
  band adds `key` to `hiddenIds`; on the Deck zone removes it. Region-level `onDragOver`/`onDrop` on
  each wrapper (so an empty zone accepts drops); dropping on the zone the card is in is a no-op.
- Hover: `onHover(card, meta, rect)` → the existing `DeckHoverPreview` via `meta.imageUrl/backImageUrl`.
- F9 and right-click on the band still clear `hiddenIds`; the "N hidden" link is replaced by the band
  header count (drop `draft_hidden` / `draft_show_all` / `draft_hide_pick` keys if unused afterwards).
- `flyCardTo` landing: `landingRow('[data-fly-target="picks"]', '.arena-stack-card[data-front]',
  (row) => row.dataset.cardKey === cardId)`.
- Band height: the picks area shares the dialog's free height with the booster (both flex, each
  `overflow-y: auto`, `min-height: 0`) instead of `max-height: 260px`.
- New i18n keys (`game` namespace): `draft_deck_zone` ("Deck"), `draft_sideboard_zone`
  ("Sideboard"), `draft_sideboard_hint` ("Drag picks here to leave them out of your deck").

TRN-21 text (to paste into the spec, then guard line once tests exist):

> ### TRN-21 · Draft picks are drawn as piles, and the sideboard is what you hide
> During a draft your picks are drawn like the deck editor's Piles view: a Deck zone with one pile per
> mana value (0 to 5, 6+, lands last) and a Sideboard band under it. Dragging a pick to the band, or
> Shift+click / S on it, moves it there; doing it again brings it back. The band is the set of hidden
> picks sent with every pick, so when construction starts the server puts every other pick in the
> main deck and keeps the band's cards in the sideboard. F9 or right-click on the band brings them
> all back. Hovering a pick shows the enlarged preview.
> - Why: the picks were a flat grid of 90 px thumbnails in a 260 px scrolling strip that read "like
>   a spreadsheet"; the user asked for the editor's piles. The server already treats hidden picks as
>   the sideboard (`DraftPlayer.prepareDeck`).
> - Guard: `src/game/draftPickStacks.test.ts` · `src/game/DraftScreen.test.tsx` · `e2e/draft.spec.ts`

- [ ] **Step 1: Rewrite the failing tests** in `DraftScreen.test.tsx`:
  - `shows picks tray` → `TRN-21: draws picks as piles in the Deck zone`: `draft-picks` contains one
    `.arena-stack-card[data-card-key="p-1"]`; `draft-sideboard` is present.
  - U9-1 test → `TRN-21: Shift+click moves a pick to the sideboard and it is sent as hidden (U9-1)`:
    `fireEvent.click(card, { shiftKey: true })` → card now inside `draft-sideboard`; then picking
    `c-1` calls `sendCardPick('draft-1', 'c-1', ['p-1'])`.
  - KEY-12 test → keep title `KEY-12: F9 shows hidden picks again (U9-1)`; hide via Shift+click,
    F9 → card back inside `draft-picks`.
  - New `TRN-21: dropping a sideboard pick on the Deck zone brings it back`: hide p-1, fire `drop`
    on `draft-picks` with `dataTransfer.getData` returning `{"source":"sideboard","key":"p-1"}` →
    card inside `draft-picks`; dropping it again on `draft-picks` leaves exactly one card.
  - New `TRN-21: the sideboard empties when a new draft starts`: hide p-1, set a draft with another
    `draftId` → `draft-sideboard` has no `.arena-stack-card`.
- [ ] **Step 2:** `npx vitest run src/game/DraftScreen.test.tsx` → the new/changed tests FAIL.
- [ ] **Step 3:** Implement the DraftScreen, CSS and i18n changes above.
- [ ] **Step 4:** Add TRN-21 to `docs/specs/tournaments.md`.
- [ ] **Step 5:** `npx vitest run src/game src/decks src/specCoverage.test.ts src/i18n` → PASS;
  `npm --prefix web run typecheck` → no errors.

### Task 4: e2e + visual check

**Files:**
- Modify: `web/e2e/draft.spec.ts` (lines ~92–93, ~121, ~161–167)

- [ ] **Step 1:** Update the selectors to the Task 3 DOM contract: the picked card is
  `[data-testid="draft-picks"] .arena-stack-card[data-front="true"]` with
  `data-card-key = firstId` and class `is-selected` (replaces `draft-pick-new`); the hide flow uses
  `click({ modifiers: ['Shift'] })` and checks the card is inside `draft-sideboard`, then F9 brings it
  back. Rename the hide test to `TRN-21: a pick moves to the sideboard and F9 brings it back`.
- [ ] **Step 2:** New test `TRN-21: 45 picks scroll in the band and no pile is clipped`: seed 45
  picks via `__mageStore` (as the file's first test does); for the last pile, `scrollIntoViewIfNeeded`
  its last front card and assert it is visible and its bounding box lies inside the picks area's box.
- [ ] **Step 3:** `cd web && npx playwright test e2e/draft.spec.ts e2e/draft-reload-construct.spec.ts`
  → PASS.
- [ ] **Step 4:** Screenshot the draft with 17 picks at 1600×900 (same seed as the design's capture)
  and look at it: piles readable, booster not covered, band scrolls.
- [ ] **Step 5:** `node scripts/test.mjs unit typecheck` → PASS. Do not commit.
