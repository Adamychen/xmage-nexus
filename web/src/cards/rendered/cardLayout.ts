import type { CardView } from '../../net/types'
import { getSourceCardName, isAbilityCard } from '../cardImages'

export type CardLayoutKind =
  | 'hidden'
  | 'facedown'
  | 'ability'
  | 'emblem'
  | 'dungeon'
  | 'split'
  | 'adventure'
  | 'planeswalker'
  | 'battle'
  | 'saga'
  | 'class'
  | 'room'
  | 'token'
  | 'standard'

export type FrameColor = 'w' | 'u' | 'b' | 'r' | 'g' | 'gold' | 'colorless' | 'land'

export interface CardFace {
  name: string
  cost: string[]
  typeLine: string
  rules: string[]
}

export interface RuleRow {
  label: string | null
  text: string
}

export interface CardLayout {
  kind: CardLayoutKind
  frame: FrameColor
  colors: FrameColor[]
  name: string
  cost: string[]
  typeLine: string
  rules: string[]
  rows: RuleRow[] | null
  power: string
  toughness: string
  loyalty: string
  defense: string
  rarity: string
  legendary: boolean
  halves: [CardFace, CardFace] | null
  fusion: boolean
  showStats: boolean
}

const COLOR_ORDER: [keyof NonNullable<CardView['color']>, FrameColor][] = [
  ['white', 'w'],
  ['blue', 'u'],
  ['black', 'b'],
  ['red', 'r'],
  ['green', 'g'],
]

const LOYALTY_ROW = /^\s*([+−–-]?\s?(?:\d+|X)):\s*([\s\S]*)$/
const CHAPTER_ROW = /^\s*((?:[IVX]+)(?:\s*,\s*[IVX]+)*)\s*(?:—|&mdash;|-)\s*([\s\S]*)$/
const LEVEL_ROW = /^\s*(Level\s+\d+(?:\s*[-–]\s*\d+|\+)?|\{[^}]+\}:\s*Level\s+\d+)\s*(?:—|&mdash;|:)?\s*([\s\S]*)$/i

function upper(list: unknown): string[] {
  return Array.isArray(list) ? list.filter((v): v is string => typeof v === 'string').map((v) => v.toUpperCase()) : []
}

function titleCase(word: string): string {
  const w = word.toLowerCase().replace(/_/g, ' ')
  return w.replace(/(^|\s)\S/g, (m) => m.toUpperCase())
}

export function cardTypeLine(card: CardView): string {
  const head = [...upper(card.superTypes), ...upper(card.cardTypes)].map(titleCase)
  const subs = upper(card.subTypes).map(titleCase)
  const left = head.join(' ')
  if (subs.length === 0) return left
  return left ? `${left} — ${subs.join(' ')}` : subs.join(' ')
}

export function abilityLine(card: CardView): string {
  const type = typeof card.abilityType === 'string' ? titleCase(card.abilityType) : ''
  return type ? `${type} ability` : 'Ability'
}

export function frameColors(card: CardView): FrameColor[] {
  const flags = card.color
  const found: FrameColor[] = []
  if (flags) for (const [key, code] of COLOR_ORDER) if (flags[key]) found.push(code)
  return found
}

export function frameFor(card: CardView, colors = frameColors(card)): FrameColor {
  if (colors.length > 1) return 'gold'
  if (colors.length === 1) return colors[0]
  return upper(card.cardTypes).includes('LAND') ? 'land' : 'colorless'
}

export function costSymbols(card: CardView): string[] {
  return [...(card.manaCostLeftStr ?? []), ...(card.manaCostRightStr ?? [])].filter((s) => typeof s === 'string' && s.length > 0)
}

function splitCostSymbols(cost: string | string[] | null | undefined): string[] {
  if (Array.isArray(cost)) return cost.filter((s) => typeof s === 'string' && s.length > 0)
  if (typeof cost !== 'string') return []
  return cost.match(/\{[^}]+\}/g) ?? []
}

export function parseRows(rules: string[], pattern: RegExp): RuleRow[] {
  return rules.map((rule) => {
    const m = pattern.exec(rule)
    return m ? { label: m[1].replace(/\s+/g, ''), text: m[2] } : { label: null, text: rule }
  })
}

const DUNGEON_MARK = /^ICON_DUNGEON_ROOM_(CURRENT|NEXT)([\s\S]*)$/

export function parseDungeonRows(rules: string[]): RuleRow[] {
  return rules.map((rule) => {
    const m = DUNGEON_MARK.exec(rule)
    if (!m) return { label: null, text: rule }
    return { label: m[1] === 'CURRENT' ? '\u25CF' : '\u2192', text: m[2] }
  })
}

function isRoomLike(subs: string[]): boolean {
  return subs.includes('ROOM')
}

export function cardLayout(card: CardView): CardLayout {
  const types = upper(card.cardTypes)
  const subs = upper(card.subTypes)
  const colors = frameColors(card)
  const rules = Array.isArray(card.rules) ? card.rules.map(String) : []
  const objectType = String(card.mageObjectType ?? '').toUpperCase()

  let kind: CardLayoutKind = 'standard'
  let rows: RuleRow[] | null = null
  let halves: [CardFace, CardFace] | null = null
  let fusion = false

  if (card.hideInfo) kind = 'hidden'
  else if (card.faceDown) kind = 'facedown'
  else if (isAbilityCard(card)) kind = 'ability'
  else if (objectType === 'EMBLEM') kind = 'emblem'
  else if (objectType === 'DUNGEON' || rules.some((r) => r.includes('ICON_DUNGEON_ROOM'))) {
    kind = 'dungeon'
    rows = parseDungeonRows(rules)
  }
  else if (card.isSplitCard && card.leftSplitName && card.rightSplitName) {
    const adventure = /adventure/i.test(card.rightSplitTypeLine ?? '') || /adventure/i.test(card.rightSplitSpellType ?? '')
    kind = adventure ? 'adventure' : 'split'
    fusion = !adventure && rules.some((r) => /^fuse\b/i.test(r.replace(/<[^>]+>/g, '')))
    halves = [
      {
        name: card.leftSplitName,
        cost: splitCostSymbols(card.leftSplitCostsStr),
        typeLine: card.leftSplitTypeLine?.trim() ?? '',
        rules: card.leftSplitRules ?? [],
      },
      {
        name: card.rightSplitName,
        cost: splitCostSymbols(card.rightSplitCostsStr),
        typeLine: card.rightSplitTypeLine?.trim() ?? '',
        rules: card.rightSplitRules ?? [],
      },
    ]
  } else if (types.includes('PLANESWALKER')) {
    kind = 'planeswalker'
    rows = parseRows(rules, LOYALTY_ROW)
  } else if (types.includes('BATTLE')) kind = 'battle'
  else if (subs.includes('SAGA')) {
    kind = 'saga'
    rows = parseRows(rules, CHAPTER_ROW)
  } else if (subs.includes('CLASS')) {
    kind = 'class'
    rows = parseRows(rules, LEVEL_ROW)
  } else if (isRoomLike(subs)) kind = 'room'
  else if (card.isToken) kind = 'token'

  return {
    kind,
    frame: frameFor(card, colors),
    colors,
    name: kind === 'ability' ? getSourceCardName(card) : card.displayName || card.name,
    cost: costSymbols(card),
    typeLine: kind === 'ability' ? abilityLine(card) : kind === 'token' ? `Token ${cardTypeLine(card)}`.trim() : cardTypeLine(card),
    rules,
    rows,
    power: card.power ?? '',
    toughness: card.toughness ?? '',
    loyalty: card.loyalty ?? '',
    defense: card.defense ?? '',
    rarity: String(card.rarity ?? '').toLowerCase(),
    legendary: upper(card.superTypes).includes('LEGENDARY'),
    halves,
    fusion,
    showStats: (types.includes('CREATURE') || subs.includes('VEHICLE')) && (card.power ?? '') !== '' && kind !== 'planeswalker',
  }
}

const LOCALIZABLE: readonly CardLayoutKind[] = ['standard', 'planeswalker', 'battle', 'saga', 'class', 'room', 'token']

export function localizedLayout(card: CardView, text: { name?: string; typeLine?: string; rules?: string[] } | null | undefined): CardLayout {
  const base = cardLayout(card)
  if (!text || !LOCALIZABLE.includes(base.kind)) return base
  const rules = text.rules && text.rules.length > 0 ? text.rules : null
  const patched = rules ? cardLayout({ ...card, rules }) : base
  return {
    ...patched,
    name: text.name || base.name,
    typeLine: text.typeLine || base.typeLine,
  }
}
