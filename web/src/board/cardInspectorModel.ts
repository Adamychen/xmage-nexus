import type { CardView, GameView, PermanentView } from '../net/types'
import { cardName } from '../cards/cardImages'
import { frameColors, parseRows, type RuleRow } from '../cards/rendered/cardLayout'
import { basePtValue, ptTrend, type PtTrend } from './ptTrend'

export type InspectorRarity = 'common' | 'uncommon' | 'rare' | 'mythic' | 'special'
export type InspectorGlow = 'w' | 'u' | 'b' | 'r' | 'g' | 'gold' | 'none'

export interface InspectorLink {
  id: string
  name: string
}

export interface InspectorState {
  power: string | null
  toughness: string | null
  basePt: string | null
  trend: { power: PtTrend; toughness: PtTrend }
  damage: number
  toughnessLeft: number | null
  /** Current loyalty, used to dim the abilities it cannot pay for. */
  loyalty: number | null
  /** Loyalty for the tile: only when it differs from the printed starting loyalty. */
  shownLoyalty: number | null
  startingLoyalty: number | null
  defense: number | null
  counters: { name: string; count: number }[]
  tapped: boolean
  summoningSick: boolean
  token: boolean
  copy: boolean
  phasedOut: boolean
  controller: string | null
  owner: string | null
  attachedTo: InspectorLink | null
  attachments: InspectorLink[]
}

export interface LoyaltyRow {
  cost: string
  sign: 'plus' | 'zero' | 'minus'
  text: string
  affordable: boolean
}

const LOYALTY_ROW = /^\s*([+−–-]?\s?(?:\d+|X)):\s*([\s\S]*)$/

function toInt(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) return Number.parseInt(value, 10)
  return null
}

function hasType(card: CardView, type: string): boolean {
  return (card.cardTypes ?? []).some((t) => String(t).toUpperCase() === type)
}

export function findPermanent(game: GameView | null | undefined, id: string | undefined): PermanentView | null {
  if (!game || !id) return null
  for (const player of game.players ?? []) {
    const perm = player.battlefield?.[id]
    if (perm) return perm
  }
  return null
}

export function inspectorRarity(card: CardView): InspectorRarity | null {
  const r = String(card.rarity ?? '').toUpperCase()
  if (r === 'COMMON') return 'common'
  if (r === 'UNCOMMON') return 'uncommon'
  if (r === 'RARE') return 'rare'
  if (r === 'MYTHIC') return 'mythic'
  if (r === 'SPECIAL' || r === 'BONUS') return 'special'
  return null
}

export function inspectorSetLabel(card: CardView): string | null {
  const set = String(card.expansionSetCode ?? '').trim().toUpperCase()
  if (!set) return null
  const number = String(card.cardNumber ?? '').trim()
  return number && number !== '0' ? `${set} #${number}` : set
}

export function inspectorGlow(card: CardView): InspectorGlow {
  const colors = frameColors(card)
  if (colors.length > 1) return 'gold'
  const [one] = colors
  return one === 'w' || one === 'u' || one === 'b' || one === 'r' || one === 'g' ? one : 'none'
}

/** The battlefield state the printed card cannot show, or null when the card is not a permanent. */
export function inspectorState(perm: PermanentView | null, game: GameView | null | undefined): InspectorState | null {
  if (!perm) return null
  const isCreature = hasType(perm, 'CREATURE')
  const isPlaneswalker = hasType(perm, 'PLANESWALKER')
  const isBattle = hasType(perm, 'BATTLE')
  const basePower = basePtValue(perm.originalPower)
  const baseToughness = basePtValue(perm.originalToughness)
  const damage = isCreature ? Math.max(0, toInt(perm.damage) ?? 0) : 0
  const toughness = toInt(perm.toughness)
  const loyalty = isPlaneswalker ? toInt(perm.loyalty) : null
  const defense = isBattle ? toInt(perm.defense) : null
  const counters = (perm.counters ?? []).filter((c) => {
    const n = c.name.toLowerCase()
    if (n === 'loyalty') return loyalty == null
    if (n === 'defense') return defense == null
    return c.count > 0
  })
  const controller = String(perm.nameController ?? '').trim() || null
  const ownerName = String(perm.nameOwner ?? '').trim()
  const owner = ownerName && ownerName !== controller ? ownerName : null
  const link = (id: string | null | undefined): InspectorLink | null => {
    const target = findPermanent(game, id ?? undefined)
    return target && id ? { id, name: cardName(target) } : null
  }
  const trend = ptTrend(perm)
  const ptChanged = trend.power !== 'same' || trend.toughness !== 'same'
  const startingLoyalty = isPlaneswalker ? toInt(perm.startingLoyalty) : null
  const startingDefense = isBattle ? toInt(perm.startingDefense) : null
  return {
    power: isCreature && ptChanged && perm.power != null ? String(perm.power) : null,
    toughness: isCreature && ptChanged && perm.toughness != null ? String(perm.toughness) : null,
    basePt: isCreature && basePower != null && baseToughness != null ? `${basePower}/${baseToughness}` : null,
    trend,
    damage,
    toughnessLeft: damage > 0 && toughness != null ? Math.max(0, toughness - damage) : null,
    loyalty,
    shownLoyalty: loyalty != null && loyalty !== startingLoyalty ? loyalty : null,
    startingLoyalty,
    defense: defense != null && defense !== startingDefense ? defense : null,
    counters,
    tapped: perm.tapped === true,
    summoningSick: isCreature && perm.summoningSickness === true && perm.tapped !== true,
    token: perm.isToken === true,
    copy: perm.copy === true,
    phasedOut: perm.phasedIn === false,
    controller,
    owner,
    attachedTo: link(perm.attachedTo),
    attachments: (perm.attachments ?? []).map((id) => link(id)).filter((l): l is InspectorLink => l != null),
  }
}

/** Whether the battlefield section has anything to show besides who controls and owns the card. */
export function hasBattlefieldDetails(state: InspectorState): boolean {
  return state.power != null || state.damage > 0 || state.shownLoyalty != null || state.defense != null
    || state.counters.length > 0 || state.tapped || state.summoningSick || state.phasedOut || state.token || state.copy
    || state.attachedTo != null || state.attachments.length > 0
}

/** A planeswalker's rules split into loyalty abilities, or null when the lines are not loyalty abilities. */
export function loyaltyRows(card: CardView, rules: string[], loyalty: number | null): LoyaltyRow[] | null {
  if (!hasType(card, 'PLANESWALKER')) return null
  const rows: RuleRow[] = parseRows(rules, LOYALTY_ROW)
  if (!rows.some((r) => r.label != null)) return null
  return rows.map((r) => {
    if (r.label == null) return { cost: '', sign: 'zero', text: r.text, affordable: true }
    const cost = r.label.replace(/[–-]/g, '−')
    const sign = cost.startsWith('+') ? 'plus' : cost.startsWith('−') ? 'minus' : 'zero'
    const amount = toInt(cost.replace('−', '-').replace('+', ''))
    const affordable = sign !== 'minus' || loyalty == null || amount == null || loyalty + amount >= 0
    return { cost, sign, text: r.text, affordable }
  })
}
