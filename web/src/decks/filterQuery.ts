export type Rarity = 'common' | 'uncommon' | 'rare' | 'mythic'
export type StatOp = '>=' | '=' | '<=' | '>' | '<'
export interface StatFilter { op: StatOp; value: number }

export interface ScryfallQueryOpts {
  rawQuery: string
  formatKey?: string | null
  colorFilter: Set<string>
  typeFilter: string | null
  cmcFilter: number | null
  rarityFilter: Set<Rarity>
  keywordFilter: Set<string>
  powerFilter: StatFilter | null
  toughnessFilter: StatFilter | null
  setFilter: string | null
}

export function buildScryfallQuery(opts: ScryfallQueryOpts): string {
  const parts: string[] = []
  const raw = opts.rawQuery.trim()
  if (raw) parts.push(raw)
  else parts.push('game:paper -t:basic')
  if (opts.formatKey) parts.push(`f:${opts.formatKey}`)
  if (opts.colorFilter.size > 0) {
    if (opts.colorFilter.has('C')) parts.push('c:c')
    else parts.push(`c<=${[...opts.colorFilter].join('').toLowerCase()}`)
  }
  if (opts.typeFilter) parts.push(`t:${opts.typeFilter.toLowerCase()}`)
  if (opts.cmcFilter !== null) {
    if (opts.cmcFilter >= 7) parts.push('cmc>=7')
    else parts.push(`cmc=${opts.cmcFilter}`)
  }
  if (opts.rarityFilter.size > 0) {
    const r = [...opts.rarityFilter]
    if (r.length === 1) parts.push(`rarity:${r[0]}`)
    else parts.push(`(${r.map((x) => `rarity:${x}`).join(' OR ')})`)
  }
  if (opts.keywordFilter.size > 0) {
    for (const kw of opts.keywordFilter) parts.push(`keyword:${kw.toLowerCase()}`)
  }
  if (opts.powerFilter) parts.push(`pow${opts.powerFilter.op}${opts.powerFilter.value}`)
  if (opts.toughnessFilter) parts.push(`tou${opts.toughnessFilter.op}${opts.toughnessFilter.value}`)
  if (opts.setFilter) {
    const s = opts.setFilter.trim().toLowerCase()
    if (s) parts.push(`set:${s}`)
  }
  return parts.join(' ')
}
