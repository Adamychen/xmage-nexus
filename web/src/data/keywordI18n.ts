export type KeywordLookup = (key: string) => string

/** CRD-8: the qualities a parameter can name, as the engine writes them, and their locale key. */
const QUALITY_KEYS: Record<string, string> = {
  white: 'quality_white',
  blue: 'quality_blue',
  black: 'quality_black',
  red: 'quality_red',
  green: 'quality_green',
  colorless: 'quality_colorless',
  'all colors': 'quality_all_colors',
  multicolored: 'quality_multicolored',
  monocolored: 'quality_monocolored',
  artifacts: 'quality_artifacts',
  creatures: 'quality_creatures',
  instants: 'quality_instants',
  sorceries: 'quality_sorceries',
  planeswalkers: 'quality_planeswalkers',
  everything: 'quality_everything',
}

function translated(lookup: KeywordLookup, key: string): string | null {
  const value = lookup(key)
  return value && value !== `keywords.${key}` ? value : null
}

/**
 * CRD-8: splits a keyword's parameter into the qualities it names. "black and from green" is two
 * of them, not one name: the engine repeats the preposition, and a list may use commas as well.
 */
export function keywordQualities(param: string): string[] {
  return param
    .split(/\s*,\s*(?:and\s+from\s+|and\s+)?|\s+and\s+from\s+|\s+and\s+/i)
    .map((part) => part.trim())
    .filter(Boolean)
}

/**
 * CRD-8: the parameter as the player's language writes it. Each quality is translated on its own
 * and they are joined with the locale's own conjunction (no spaces around one that is not written
 * with letters, as in Japanese or Chinese). A quality with no translation, a creature type or a
 * number, is left exactly as the engine wrote it.
 */
export function localizeKeywordParam(param: string | undefined, lookup: KeywordLookup): string | undefined {
  if (!param) return param
  const parts = keywordQualities(param).map((quality) => {
    const key = QUALITY_KEYS[quality.toLowerCase()]
    return (key && translated(lookup, key)) || quality
  })
  if (parts.length < 2) return parts[0] ?? param
  const word = translated(lookup, 'quality_and') ?? 'and'
  const join = /^[A-Za-zÀ-ɏ]/.test(word) ? ` ${word} ` : word
  return [parts.slice(0, -1).join(', '), parts[parts.length - 1]].join(join)
}

function fillParam(tpl: string, param?: string): string {
  if (!tpl.includes('{param}')) return tpl
  return tpl.replaceAll('{param}', (param ?? '').trim()).replace(/\s{2,}/g, ' ').trim()
}

export function keywordDisplayName(id: string, fallbackEn: string, lookup: KeywordLookup, param?: string): string {
  const quality = localizeKeywordParam(param, lookup)
  const tpl = lookup(`${id}_name`)
  if (!tpl || tpl === `keywords.${id}_name`) {
    return quality ? `${fallbackEn} ${quality}`.trim() : fallbackEn
  }
  return fillParam(tpl, quality)
}

export function keywordSummary(id: string, lookup: KeywordLookup, param?: string, fallback = ''): string {
  const tpl = lookup(`${id}_summary`)
  if (!tpl || tpl === `keywords.${id}_summary`) return fallback
  if (tpl.includes('{param}')) return tpl.replaceAll('{param}', localizeKeywordParam(param, lookup) ?? 'N')
  return tpl
}

export function keywordRuleRef(ruleSnippet: string | undefined, lookupPath: (path: string) => string): string | undefined {
  if (!ruleSnippet) return undefined
  if (ruleSnippet === 'Regla oficial de MTG.') return lookupPath('wiki.rule_official')
  if (ruleSnippet === 'Palabra de Habilidad oficial de MTG.') return lookupPath('wiki.rule_ability_word')
  return ruleSnippet
}
