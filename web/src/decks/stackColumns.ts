import type { DeckCard } from '../lobby/decks'
import type { CardStripMeta } from './ArenaCardStrip'
import type { StackColumn, StackItem } from './ArenaCardStacks'
import { CARD_CATEGORY_ORDER, categorizeCard, type CardCategory } from './cardCategory'
import { deckCardKey } from './deckCardOps'
import { edhPowerLevel } from './edhPowerLevel'
import { isMetaLoaded } from './metaLoaded'
import { reconcileCopies, type DeckStackPiles } from './stackPiles'

export type StackGroup = 'type' | 'cmc' | 'color' | 'identity' | 'edh' | 'rarity' | 'free'
export type StackSort = 'cmc' | 'name'
export type ColourKey = 'W' | 'U' | 'B' | 'R' | 'G' | 'multi' | 'colorless'

export interface StackLabels {
  type: Record<CardCategory, string>
  cmc: (n: number) => string
  lands: string
  color: Record<ColourKey, string>
  rarity: Record<'mythic' | 'rare' | 'uncommon' | 'common' | 'other', string>
  edh: (n: number) => string
  loading: string
  unsorted: string
  commander: string
}

export interface BuildStackOptions {
  group: StackGroup
  sort: StackSort
  labels: StackLabels
  keyPrefix?: string
  piles?: DeckStackPiles
  commanderKeys?: Set<string>
  singlePile?: { id: string; label: string }
}

type BucketGroup = Exclude<StackGroup, 'free'>
type RarityId = 'mythic' | 'rare' | 'uncommon' | 'common' | 'other'

const CMC_LAST = 6
const WUBRG: readonly string[] = ['W', 'U', 'B', 'R', 'G']
const RARITY_ORDER: readonly RarityId[] = ['mythic', 'rare', 'uncommon', 'common', 'other']
const CMC_ORDER: readonly string[] = [...Array.from({ length: CMC_LAST + 1 }, (_, n) => `cmc-${n}`), 'lands']
const COLOR_ORDER: readonly string[] = ['W', 'U', 'B', 'R', 'G', 'multi', 'colorless', 'lands']
const IDENTITY_ORDER: readonly string[] = ['id-W', 'id-U', 'id-B', 'id-R', 'id-G', 'id-multi', 'id-colorless']
const GROUP_ORDER: Record<Exclude<BucketGroup, 'edh'>, readonly string[]> = {
  type: CARD_CATEGORY_ORDER,
  cmc: CMC_ORDER,
  color: COLOR_ORDER,
  identity: IDENTITY_ORDER,
  rarity: RARITY_ORDER,
}

function colourBucket(colours: readonly string[]): string {
  if (colours.length === 0) return 'colorless'
  if (colours.length > 1) return 'multi'
  const colour = colours[0].toUpperCase()
  return WUBRG.includes(colour) ? colour : 'colorless'
}

const edhLevelOf = (id: string) => Number(id.slice('edh-'.length))

function groupBucket(group: BucketGroup, card: DeckCard, meta: CardStripMeta): string {
  const category = categorizeCard(meta.typeLine)
  if (group === 'type') return category
  if (group === 'cmc') {
    if (category === 'lands') return 'lands'
    const cmc = meta.cmc ?? 0
    const value = Number.isFinite(cmc) ? Math.min(CMC_LAST, Math.max(0, Math.floor(cmc))) : 0
    return `cmc-${value}`
  }
  if (group === 'color') {
    if (category === 'lands') return 'lands'
    return colourBucket(meta.colors ?? [])
  }
  if (group === 'identity') return `id-${colourBucket(meta.colorIdentity ?? meta.colors ?? [])}`
  if (group === 'edh') return `edh-${edhPowerLevel({ ...meta, name: card.cardName })}`
  const rarity = (meta.rarity ?? '').toLowerCase()
  return (RARITY_ORDER as readonly string[]).includes(rarity) ? rarity : 'other'
}

function bucketLabel(group: BucketGroup, id: string, labels: StackLabels): string {
  if (group === 'type') return labels.type[id as CardCategory]
  if (group === 'cmc') return id === 'lands' ? labels.lands : labels.cmc(Number(id.slice('cmc-'.length)))
  if (group === 'color') return id === 'lands' ? labels.lands : labels.color[id as ColourKey]
  if (group === 'identity') return labels.color[id.slice('id-'.length) as ColourKey]
  if (group === 'edh') return labels.edh(edhLevelOf(id))
  return labels.rarity[id as RarityId]
}

function bucketIds(group: BucketGroup, buckets: Map<string, StackItem[]>): readonly string[] {
  if (group === 'edh') return [...buckets.keys()].sort((a, b) => edhLevelOf(a) - edhLevelOf(b))
  return GROUP_ORDER[group]
}

const byName = (a: StackItem, b: StackItem) => a.card.cardName.localeCompare(b.card.cardName)
const typeIndex = (item: StackItem) => CARD_CATEGORY_ORDER.indexOf(categorizeCard(item.meta?.typeLine))
const byTypeThenName = (a: StackItem, b: StackItem) => typeIndex(a) - typeIndex(b) || byName(a, b)
const byCmcThenName = (a: StackItem, b: StackItem) => (a.meta?.cmc ?? 0) - (b.meta?.cmc ?? 0) || byName(a, b)

export function buildStackColumns(
  cards: DeckCard[],
  metaOf: (card: DeckCard) => CardStripMeta | undefined,
  opts: BuildStackOptions,
): StackColumn[] {
  const { group, sort, labels, keyPrefix = '', piles, commanderKeys, singlePile } = opts
  const order = sort === 'name' ? byName : group === 'cmc' ? byTypeThenName : byCmcThenName
  const sorted = (items: StackItem[], by: (a: StackItem, b: StackItem) => number = order) => [...items].sort(by)

  const commander: StackItem[] = []
  const loading: StackItem[] = []
  const unsorted: StackItem[] = []
  const single: StackItem[] = []
  const buckets = new Map<string, StackItem[]>()
  const pileOrder = piles?.piles.map((p) => p.id) ?? []
  const put = (id: string, item: StackItem) => buckets.set(id, [...(buckets.get(id) ?? []), item])

  for (const card of cards) {
    const meta = metaOf(card)
    const loaded = isMetaLoaded(meta)
    const cardKey = deckCardKey(card)
    const key = `${keyPrefix}${cardKey}`
    const item: StackItem = loaded ? { key, card, meta } : { key, card, loading: true }
    if (commanderKeys?.has(cardKey)) {
      commander.push(item)
    } else if (group === 'free') {
      if (singlePile) {
        single.push(item)
      } else {
        const split = reconcileCopies(piles?.assign[cardKey] ?? {}, card.amount, pileOrder)
        for (const [pileId, copies] of Object.entries(split.piles)) {
          put(pileId, { ...item, card: { ...card, amount: copies } })
        }
        if (split.unsorted > 0) unsorted.push({ ...item, card: { ...card, amount: split.unsorted } })
      }
    } else if (!loaded) {
      loading.push(item)
    } else {
      put(groupBucket(group, card, meta), item)
    }
  }

  const columns: StackColumn[] = []
  if (commander.length > 0) {
    columns.push({ id: 'commander', label: labels.commander, kind: 'commander', items: sorted(commander) })
  }

  if (group === 'free') {
    if (singlePile) {
      columns.push({ id: singlePile.id, label: singlePile.label, kind: 'single', items: sorted(single) })
      return columns
    }
    if (unsorted.length > 0) {
      columns.push({ id: 'unsorted', label: labels.unsorted, kind: 'unsorted', items: sorted(unsorted) })
    }
    for (const pile of piles?.piles ?? []) {
      columns.push({ id: pile.id, label: pile.label, kind: 'pile', items: sorted(buckets.get(pile.id) ?? []) })
    }
    return columns
  }

  if (loading.length > 0) {
    columns.push({ id: 'loading', label: labels.loading, kind: 'loading', items: sorted(loading, byName) })
  }
  for (const id of bucketIds(group, buckets)) {
    const items = buckets.get(id)
    if (items && items.length > 0) {
      columns.push({ id, label: bucketLabel(group, id, labels), kind: 'group', items: sorted(items) })
    }
  }
  return columns
}

const SEPARATABLE_GROUPS: ReadonlySet<StackGroup> = new Set<StackGroup>(['cmc', 'color', 'identity', 'edh', 'rarity'])

export function canSeparateCreatures(group: StackGroup): boolean {
  return SEPARATABLE_GROUPS.has(group)
}

export function splitCreatureRows(
  cards: DeckCard[],
  metaOf: (card: DeckCard) => CardStripMeta | undefined,
  opts: BuildStackOptions,
): { creatures: StackColumn[]; others: StackColumn[] } {
  if (!canSeparateCreatures(opts.group)) return { creatures: buildStackColumns(cards, metaOf, opts), others: [] }
  const firstRow = (card: DeckCard) => {
    if (opts.commanderKeys?.has(deckCardKey(card))) return true
    const meta = metaOf(card)
    return !isMetaLoaded(meta) || categorizeCard(meta.typeLine) === 'creatures'
  }
  return {
    creatures: buildStackColumns(cards.filter(firstRow), metaOf, opts),
    others: buildStackColumns(cards.filter((card) => !firstRow(card)), metaOf, { ...opts, commanderKeys: undefined }),
  }
}

export function buildTypeColumns(
  cards: DeckCard[],
  metaOf: (card: DeckCard) => CardStripMeta | undefined,
  labels: Record<CardCategory, string> & { loading?: string },
  keyPrefix = '',
): StackColumn[] {
  return buildStackColumns(cards, metaOf, {
    group: 'type',
    sort: 'cmc',
    keyPrefix,
    labels: {
      type: labels,
      cmc: () => '',
      lands: '',
      color: { W: '', U: '', B: '', R: '', G: '', multi: '', colorless: '' },
      rarity: { mythic: '', rare: '', uncommon: '', common: '', other: '' },
      edh: () => '',
      loading: labels.loading ?? '',
      unsorted: '',
      commander: '',
    },
  })
}
