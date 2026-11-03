# One pure layout function for the whole board

Rules: `docs/specs/board.md` BRD-21 (rewritten), BRD-25, BRD-26, BRD-27, BRD-28.

## Problem (measured 2026-11-01)

Card sizes on the board come from about seven feedback controllers that measure DOM the others write:
`useZoneScale` (one per seat, `MutationObserver` on the whole subtree), five `useBandFit` per seat,
`useOwnCardCap` (reads another seat's applied `--card-w`), the hand fitter and `useLaneFit`. Their
measurements include their own output (the horizontal scrollbar eats ~10 px of a band's height; sibling
band widths depend on whether the neighbour wrapped). Loops were damped with memory (`settleBandCardW`
2 px hysteresis, the overflow `ceiling` in `useBandFit`, `galleryPinnedStatusH`), which leaves:

1. A resize loop: Table, 4 seats, compact cards, scrollbars visible, 1600 → 1000 px: lands/others bands
   flip 47↔110 px, 1↔2 lines, 120-180 style writes per second. Fresh draws at 1000 px are stable, so
   `board-settle.spec.ts` (fresh draws, `--hide-scrollbars`, `MAX_CHANGES = 2`) is green.
2. Path dependence: 1600 → 1000 → 1600 px gives different band sizes than a fresh draw at 1600 px.
3. Bad allocation: own creatures band 38 px wide (floor) for 7 creatures beside a 122 px marquee band for
   1 planeswalker.

Probe used to measure it (not committed): two Playwright specs that draw a rich game, resize step by
step, count `style`/`data-band-lines` mutations after a 700 ms settle and diff fresh vs resized snapshots.

## Design

### Inputs are only things the function never writes

Seat boxes are content-independent already: `.game-board > .board-zone { flex: 1 1 0 }`, Arena opponents
row `flex: 0 0 40%`, focus strip `--seat-focus-strip-w`. So the provider measures, in one pass:

- each seat element's content box (`.board-zone`, after padding);
- each seat's status row height (`.bz-status-row, .pz-bottom-row, .oz-top-row, .oz-bottom-row`), which
  BRD-21 already makes independent of card size (the compact hand takes no height of its own);
- CSS constants read once per change of settings (band gap `--sp-2h`, band padding, row gap, marquee
  padding), via `getComputedStyle` on a band. These are tokens, not outputs.

Item widths are NOT measured: they come from `itemModel.ts` (below), guarded by BRD-28.

### `web/src/board/layout/` (new, pure, no DOM, no React)

```ts
// itemModel.ts
export interface ItemModel { a: number; b: number }   // width(c) = a * c + b  (px, c = card width)
export type ItemKind =
  | { kind: 'card'; tapped: boolean; attachments: number }
  | { kind: 'pile'; pile: 'land' | 'token'; count: number; tapped: number }  // tapped = how many tapped
export function itemModel(item: ItemKind, opts: { compact: boolean; tilted: boolean }): ItemModel

// solveRow.ts
export interface BandInput { id: string; items: ItemModel[]; minWidthCards?: number; maxWidthNeed?: boolean }
export interface RowInput {
  width: number; height: number           // row box in px
  bands: BandInput[]
  gap: number; padX: number; padY: number; rowGap: number; bandGap: number
  aspect: number                           // card height / width (1.4 classic, 0.75 compact)
  minW: number; maxW: number               // floor and cap for the card width
  maxLines?: number                        // default 3
}
export interface BandOut { id: string; width: number; cardW: number; lines: number; overflow: boolean }
export interface RowOut { cardW: number; bands: BandOut[] }
export function solveRow(input: RowInput): RowOut

// solveBoardLayout.ts
export interface SeatInput {
  id: string; own: boolean
  box: { width: number; height: number }; statusH: number
  rows: { creatures: Omit<RowInput, 'width' | 'height' | 'aspect' | 'minW' | 'maxW'>; permanents: ... }
  shares: { creatures: number; permanents: number }   // from bandShares(): fr weights of the two rows
  capW: number                                       // seat cap (MAX_* of useZoneScale, focus maxCardW)
  compactPod: boolean
}
export interface BoardInput { layout: 'standard' | 'pod' | 'arena' | 'table' | 'spotlight' | '2hg'; seats: SeatInput[]; aspect: number; opponentsCappedByOwn: boolean }
export interface SeatOut { id: string; zoneCardW: number; rows: { creatures: RowOut; permanents: RowOut } }
export interface BoardOut { seats: SeatOut[] }
export function solveBoardLayout(input: BoardInput): BoardOut
```

### Algorithm

`solveRow`:

- `need(band, c, L)`: split the band's items, in order, into `L` contiguous lines minimising the widest
  line; a line's width is `Σ(a·c + b) + (n − 1)·gap + 2·padX`; the band's width need is the widest line.
  Height need is `L·c·aspect + (L − 1)·rowGap + 2·padY` and must be ≤ the row height.
- For a card width `c`, each band takes the `L ∈ [1, maxLines]` with the smallest width need whose height
  fits (none fits → not feasible at `c`). The row fits at `c` when `Σ need + (bands − 1)·bandGap ≤ width`.
- Feasibility is monotone in `c`: binary search the largest integer `c ∈ [minW, maxW]` that fits.
- None fits at `minW`: `c = minW`, every band takes `L` = the most lines whose height fits, and widths are
  shared in proportion to need; bands whose need exceeds their width get `overflow: true`.
- Fits: each band gets its need, plus the leftover width shared in proportion to need. Widths are integers
  summing exactly to `width − (bands − 1)·bandGap` (largest-remainder rounding).
- Marquee constraint (BRD-2): a band with `minWidthCards: 1` is never narrower than one card at `maxW`
  plus padding when the row is wide enough for it; it never takes more than its need of the leftover
  (`maxWidthNeed: true` → leftover goes to the other bands).
- A band with no items is not in the row.

`solveBoardLayout`:

- Per seat: card area height `= box.height − statusH − overhead` (overhead 12 px, 6 px in compact pod,
  as `useZoneScale`); row heights split by `shares`; `zoneCardW = clamp(minW, capW, rowHeight·tallest/aspect)`
  with the same constants as `useZoneScale` (MIN 44, MAX 240/280 player, compact 190/230).
- Rows solved with `solveRow`, `maxW = zoneCardW`, floor 46 px (38 px compact pod).
- `opponentsCappedByOwn` (Arena/Table): solve the own seat first, then cap every opponent's `capW` at the
  own seat's largest row card width. No seat ever reads another seat's DOM.
- Same input → same output, always (no state, no memory).

### Wiring (`web/src/board/layout/BoardLayoutProvider.tsx`)

- Wraps the board inside `BoardShell` (every layout renders seats through `BoardZone`).
- `BoardZone` registers, from the game view (not the DOM): its seat element, its row/band item lists
  (`ItemKind[]` per band, built from the same grouping it already renders: `landGroups`, `tokenGroups`,
  solos, marquee entries, commander), its `shares`, its cap.
- One `ResizeObserver` on the board element and every registered seat element and status row; any
  observed resize or registration change schedules one `requestAnimationFrame` that measures inputs,
  calls `solveBoardLayout`, and writes, only where the value differs: `--zone-card-w` on the seat,
  `--card-w`, `flex: 0 0 <width>px` and `data-band-lines` on each band. No `MutationObserver`.
- Dispatches `BOARD_RELAYOUT_EVENT` when anything was written (combat arrows listen to it).
- `useZoneScale`, `useBandFit`, `bandFit.ts`, `useOwnCardCap`/`ownCardCap.ts`, `galleryPinnedStatusH`
  and the gallery's `data-gallery-status-h` pin are deleted; their unit tests go with them or move to the
  layout tests. Consumers of `useOwnCardCap`'s value (`ArenaBoard`) read the own seat's card width from
  the provider's result instead.
- BRD-27: bands get `scrollbar-width: none` (+ `::-webkit-scrollbar { display: none }`) and a mask fade on
  the clipped edge when `overflow` is true (`data-band-overflow`); drag-to-scroll (`useDragScroll`) stays.

## Packages (Haiku agents, effort high)

1. **Guards (red first)**: `e2e/board-settle.spec.ts` (scrollbars visible, resize path, `MAX_CHANGES = 0`),
   new `e2e/board-resize.spec.ts` (BRD-25 path independence, BRD-26 allocation, BRD-27 no scrollbar
   height). Must fail on the current code.
2. **Pure solver**: `web/src/board/layout/{itemModel,solveRow,solveBoardLayout}.ts` + vitest property tests.
3. **Item model contract**: `e2e/board-item-model.spec.ts` (BRD-28), after 2.
4. **Wiring**: provider, `BoardZone` switch, deletions, CSS for BRD-27, gallery cleanup, after 2.
5. Orchestrator: full fake e2e, lessons, ROADMAP, coverage docs.
