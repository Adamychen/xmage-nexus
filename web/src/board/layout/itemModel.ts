export interface ItemModel {
  a: number
  b: number
}

export type ItemKind =
  | { kind: 'card'; tapped: boolean; attachments: number; mutateParts?: number }
  | { kind: 'pile'; pile: 'land' | 'token'; count: number; tapped: number }
  | { kind: 'commander'; commanders: number; compactPod: boolean; planes?: number; emblems?: number }

export interface ItemOpts {
  compact: boolean
  tilted: boolean
}

interface Lin {
  a: number
  b: number
}

const NONE: Lin = { a: 0, b: 0 }

const TAP_CLASSIC = 0.2
const TAP_COMPACT = -0.21875
const TAP_COMPACT_TILTED = -0.125

const LAND_PAIR = -0.72
const LAND_PAIR_COMPACT = -0.86
const LAND_PAIR_COMPACT_TAPPED = -0.66
const LAND_PAIR_COMPACT_TAPPED_TILTED = -0.725

const TOKEN_PAIR = -1
const TOKEN_PAIR_TAPPED = -1.2
const TOKEN_PAIR_COMPACT_TAPPED = -0.78125
const TOKEN_PAIR_COMPACT_TAPPED_TILTED = -0.875
const PILE_EDGE = 6

const ATTACH_STEP = 24
const MUTATE_STEP = 14

const COMMANDER_POD_MULTI_SCALE = 0.88

function tapSide(tapped: boolean, opts: ItemOpts): Lin {
  if (!tapped) return NONE
  if (!opts.compact) return { a: TAP_CLASSIC, b: 0 }
  return { a: opts.tilted ? TAP_COMPACT_TILTED : TAP_COMPACT, b: 0 }
}

function pairLeft(pile: 'land' | 'token', bothTapped: boolean, opts: ItemOpts): Lin {
  if (pile === 'land') {
    if (!opts.compact) return { a: LAND_PAIR, b: 0 }
    if (!bothTapped) return { a: LAND_PAIR_COMPACT, b: 0 }
    return { a: opts.tilted ? LAND_PAIR_COMPACT_TAPPED_TILTED : LAND_PAIR_COMPACT_TAPPED, b: 0 }
  }
  if (!bothTapped) return { a: TOKEN_PAIR, b: PILE_EDGE }
  if (!opts.compact) return { a: TOKEN_PAIR_TAPPED, b: PILE_EDGE }
  return { a: opts.tilted ? TOKEN_PAIR_COMPACT_TAPPED_TILTED : TOKEN_PAIR_COMPACT_TAPPED, b: PILE_EDGE }
}

function pileModel(pile: 'land' | 'token', count: number, tapped: number, opts: ItemOpts): ItemModel {
  let a = 0
  let b = 0
  const tappedCount = Math.min(Math.max(tapped, 0), count)
  for (let i = 0; i < count; i++) {
    const cur = i < tappedCount
    const left = i === 0 ? tapSide(cur, opts) : pairLeft(pile, cur && i - 1 < tappedCount, opts)
    const right = tapSide(cur, opts)
    a += 1 + left.a + right.a
    b += left.b + right.b
  }
  return { a, b }
}

function commanderModel(commanders: number, compactPod: boolean, planes: number, emblems: number): ItemModel {
  const multi = commanders > 1
  const pad = multi ? 4 : 6
  const gap = multi ? 4 : 6
  const emblemWrap = emblems > 0 ? 1 : 0
  const children = commanders + planes + emblemWrap
  const scale = multi && compactPod ? COMMANDER_POD_MULTI_SCALE : 1
  return { a: commanders * scale + planes + emblemWrap, b: 2 * (pad + 1) + Math.max(0, children - 1) * gap }
}

/** Width of one band item as `a * c + b` px, derived from CardSlot.css, BoardZone.css and CommandZone.css (BRD-28). */
export function itemModel(item: ItemKind, opts: ItemOpts): ItemModel {
  if (item.kind === 'pile') return pileModel(item.pile, item.count, item.tapped, opts)
  if (item.kind === 'commander') return commanderModel(item.commanders, item.compactPod, item.planes ?? 0, item.emblems ?? 0)
  const mutate = item.mutateParts ?? 0
  if (item.attachments > 0 || mutate > 0) {
    return { a: 1, b: ATTACH_STEP * item.attachments + MUTATE_STEP * mutate }
  }
  const side = tapSide(item.tapped, opts)
  return { a: 1 + 2 * side.a, b: 0 }
}
