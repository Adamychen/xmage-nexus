import type { Rarity, StatFilter } from './filterQuery'
import type { ScryfallSearchCard, ScryfallSortDir, ScryfallSortOrder } from './scryfallSearch'

export interface ArenaFilterValues {
  rawQuery: string
  colorFilter: Set<string>
  cmcFilter: number | null
  typeFilter: string | null
  rarityFilter: Set<Rarity>
  keywordFilter: Set<string>
  powerFilter: StatFilter | null
  toughnessFilter: StatFilter | null
  setFilter: string | null
}

export function hasActiveArenaFilters(f: ArenaFilterValues): boolean {
  return (
    f.rawQuery.trim() !== '' ||
    f.colorFilter.size > 0 ||
    f.cmcFilter !== null ||
    f.typeFilter !== null ||
    f.rarityFilter.size > 0 ||
    f.keywordFilter.size > 0 ||
    f.powerFilter !== null ||
    f.toughnessFilter !== null ||
    (f.setFilter !== null && f.setFilter.trim() !== '')
  )
}

const lower = (v: string | undefined | null): string => (v ?? '').toLowerCase()

function typeLineOf(card: ScryfallSearchCard): string {
  const faces = card.card_faces ?? []
  return [card.type_line, card.printed_type_line, faces[0]?.type_line, faces[0]?.printed_type_line]
    .filter(Boolean)
    .map(lower)
    .join(' ')
}

function oracleTextOf(card: ScryfallSearchCard): string {
  return [card.oracle_text, ...(card.card_faces ?? []).map((f) => f.oracle_text)]
    .filter(Boolean)
    .map(lower)
    .join('\n')
}

function namesOf(card: ScryfallSearchCard): string {
  return [card.name, card.printed_name, ...(card.card_faces ?? []).flatMap((f) => [f.name, f.printed_name])]
    .filter(Boolean)
    .map(lower)
    .join(' ')
}

function frontFaceName(name: string): string {
  return name.split(/\s*\/\/\s*/)[0]
}

function powerOf(card: ScryfallSearchCard): string | undefined {
  return card.power ?? card.card_faces?.[0]?.power
}

function toughnessOf(card: ScryfallSearchCard): string | undefined {
  return card.toughness ?? card.card_faces?.[0]?.toughness
}

const RARITY_RANK: Record<string, number> = { common: 0, uncommon: 1, rare: 2, special: 3, mythic: 4, bonus: 5 }

const COLOR_WORDS: Record<string, string> = {
  white: 'W', blue: 'U', black: 'B', red: 'R', green: 'G',
  colorless: 'C',
  w: 'W', u: 'U', b: 'B', r: 'R', g: 'G', c: 'C',
}

function parseColorValue(value: string): Set<string> {
  const v = value.trim().toLowerCase()
  if (COLOR_WORDS[v]) return new Set([COLOR_WORDS[v]])
  const out = new Set<string>()
  for (const ch of v) {
    const color = COLOR_WORDS[ch]
    if (color && color !== 'C') out.add(color)
  }
  return out
}

function compareNumber(n: number, op: string, target: number): boolean {
  switch (op) {
    case ':':
    case '=':
      return n === target
    case '<=':
      return n <= target
    case '>=':
      return n >= target
    case '<':
      return n < target
    case '>':
      return n > target
    default:
      return false
  }
}

function statMatches(raw: string | undefined, op: string, value: string): boolean {
  const n = Number(raw)
  const target = Number(value)
  if (!Number.isFinite(n) || !Number.isFinite(target)) return false
  return compareNumber(n, op, target)
}

function identityWithin(card: ScryfallSearchCard, selected: Set<string>): boolean {
  const identity = card.color_identity ?? []
  if (selected.has('C')) return identity.length === 0
  return identity.every((c) => selected.has(c))
}

function keywordMatches(card: ScryfallSearchCard, keyword: string): boolean {
  const want = lower(keyword).replace(/\s+/g, ' ').trim()
  if ((card.keywords ?? []).some((k) => lower(k).replace(/\s+/g, ' ').trim() === want)) return true
  return oracleTextOf(card).includes(want)
}

interface QueryToken {
  negate: boolean
  key: string | null
  op: string
  value: string
}

function stripQuotes(value: string): string {
  const v = value.trim()
  if (v.length >= 2 && v.startsWith('"') && v.endsWith('"')) return v.slice(1, -1)
  return v
}

function parseQueryTokens(raw: string): QueryToken[] {
  const tokens = raw.match(/(?:[^\s"]+|"[^"]*")+/g) ?? []
  return tokens.map((rawToken) => {
    let token = rawToken
    let negate = false
    if (token.startsWith('-') && token.length > 1) {
      negate = true
      token = token.slice(1)
    }
    if (token.startsWith('!')) {
      return { negate, key: '!', op: '=', value: stripQuotes(token.slice(1)) }
    }
    const m = /^([a-zA-Z]+)(:|<=|>=|=|<|>)(.*)$/.exec(token)
    if (!m) return { negate, key: null, op: '', value: stripQuotes(token) }
    return { negate, key: m[1].toLowerCase(), op: m[2], value: stripQuotes(m[3]) }
  })
}

function matchesToken(card: ScryfallSearchCard, token: QueryToken): boolean {
  const value = token.value.trim()
  if (!value) return true
  const v = value.toLowerCase()
  let hit = true
  switch (token.key) {
    case '!':
      hit = lower(card.name) === v || lower(frontFaceName(card.name)) === v
      break
    case 't':
    case 'type':
      hit = typeLineOf(card).includes(v)
      break
    case 'o':
    case 'oracle':
      hit = oracleTextOf(card).includes(v)
      break
    case 'name':
    case 'n':
      hit = namesOf(card).includes(v)
      break
    case 'c':
    case 'color':
    case 'colour':
    case 'id':
    case 'ci':
    case 'identity': {
      const want = parseColorValue(v)
      const identity = card.color_identity ?? []
      if (want.size === 0) {
        hit = token.op === '>=' || identity.length === 0
      } else {
        const within = identity.every((c) => want.has(c))
        switch (token.op) {
          case ':':
          case '=':
            hit = identity.length === want.size && within
            break
          case '<=':
            hit = within
            break
          case '<':
            hit = identity.length < want.size && within
            break
          case '>=':
            hit = [...want].every((c) => identity.includes(c))
            break
          case '>':
            hit = identity.length > want.size && [...want].every((c) => identity.includes(c))
            break
          default:
            hit = false
        }
      }
      break
    }
    case 'cmc':
    case 'mv':
    case 'manavalue':
      hit = statMatches(String(card.cmc ?? ''), token.op, v)
      break
    case 'pow':
    case 'power':
      hit = statMatches(powerOf(card), token.op, v)
      break
    case 'tou':
    case 'tough':
    case 'toughness':
      hit = statMatches(toughnessOf(card), token.op, v)
      break
    case 'r':
    case 'rarity': {
      const rank = RARITY_RANK[lower(card.rarity)]
      const want = RARITY_RANK[v]
      hit = rank !== undefined && want !== undefined &&
        (token.op === ':' || token.op === '=' ? rank === want : compareNumber(rank, token.op, want))
      break
    }
    case 's':
    case 'set':
    case 'e':
    case 'edition':
      hit = lower(card.set) === v
      break
    case 'kw':
    case 'keyword':
      hit = keywordMatches(card, v)
      break
    case 'f':
    case 'format':
    case 'legal':
      hit = card.legalities?.[v] === 'legal'
      break
    case null:
      hit = namesOf(card).includes(v) || typeLineOf(card).includes(v) || oracleTextOf(card).includes(v)
      break
    default:
      // Directivas de búsqueda de Scryfall que no aplican al filtrado local
      // (game:, lang:, is:, year:, usd:…): se ignoran en vez de vaciar el panel.
      hit = true
      break
  }
  return token.negate ? !hit : hit
}

export function matchesRawQuery(card: ScryfallSearchCard, rawQuery: string): boolean {
  const tokens = parseQueryTokens(rawQuery)
  return tokens.every((token) => matchesToken(card, token))
}

export function matchesArenaFilters(card: ScryfallSearchCard, f: ArenaFilterValues): boolean {
  if (!matchesRawQuery(card, f.rawQuery)) return false
  if (f.colorFilter.size > 0 && !identityWithin(card, f.colorFilter)) return false
  if (f.typeFilter && !typeLineOf(card).includes(f.typeFilter.toLowerCase())) return false
  if (f.cmcFilter !== null) {
    const cmc = card.cmc ?? 0
    if (f.cmcFilter >= 7 ? cmc < 7 : cmc !== f.cmcFilter) return false
  }
  if (f.rarityFilter.size > 0 && !f.rarityFilter.has(lower(card.rarity) as Rarity)) return false
  for (const keyword of f.keywordFilter) {
    if (!keywordMatches(card, keyword)) return false
  }
  if (f.powerFilter && !statMatches(powerOf(card), f.powerFilter.op, String(f.powerFilter.value))) return false
  if (f.toughnessFilter && !statMatches(toughnessOf(card), f.toughnessFilter.op, String(f.toughnessFilter.value))) return false
  if (f.setFilter && lower(card.set) !== f.setFilter.trim().toLowerCase()) return false
  return true
}

function nameCompare(a: ScryfallSearchCard, b: ScryfallSearchCard): number {
  return lower(frontFaceName(a.name)).localeCompare(lower(frontFaceName(b.name)))
}

function colorKey(card: ScryfallSearchCard): number {
  const bits: Record<string, number> = { W: 1, U: 2, B: 4, R: 8, G: 16 }
  return (card.color_identity ?? []).reduce((sum, c) => sum | (bits[c] ?? 0), 0)
}

function compareCards(a: ScryfallSearchCard, b: ScryfallSearchCard, order: ScryfallSortOrder): number {
  switch (order) {
    case 'name':
      return nameCompare(a, b)
    case 'rarity':
      return ((RARITY_RANK[lower(a.rarity)] ?? -1) - (RARITY_RANK[lower(b.rarity)] ?? -1)) || nameCompare(a, b)
    case 'color':
      return (colorKey(a) - colorKey(b)) || nameCompare(a, b)
    case 'released':
      return lower(a.released_at).localeCompare(lower(b.released_at)) || nameCompare(a, b)
    case 'cmc':
      return ((a.cmc ?? 0) - (b.cmc ?? 0)) || nameCompare(a, b)
    default:
      return 0
  }
}

/** Ordena las sugerencias dentro de su sección. 'edhrec' conserva el orden
 *  del listado (su ranking de sinergia); el resto ordena por campo. */
export function sortSuggestionEntries<T extends { card: ScryfallSearchCard }>(
  entries: T[],
  order: ScryfallSortOrder,
  dir: ScryfallSortDir,
): T[] {
  const sorted = [...entries]
  if (order === 'edhrec') return dir === 'desc' ? sorted.reverse() : sorted
  const sign = dir === 'desc' ? -1 : 1
  return sorted.sort((a, b) => sign * compareCards(a.card, b.card, order))
}
