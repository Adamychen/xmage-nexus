export type KeywordLookup = (key: string) => string

function fillParam(tpl: string, param?: string): string {
  if (!tpl.includes('{param}')) return tpl
  return tpl.replaceAll('{param}', (param ?? '').trim()).replace(/\s{2,}/g, ' ').trim()
}

export function keywordDisplayName(id: string, fallbackEn: string, lookup: KeywordLookup, param?: string): string {
  const tpl = lookup(`${id}_name`)
  if (!tpl || tpl === `keywords.${id}_name`) {
    return param ? `${fallbackEn} ${param}`.trim() : fallbackEn
  }
  return fillParam(tpl, param)
}

export function keywordSummary(id: string, lookup: KeywordLookup, param?: string, fallback = ''): string {
  const tpl = lookup(`${id}_summary`)
  if (!tpl || tpl === `keywords.${id}_summary`) return fallback
  if (tpl.includes('{param}')) return tpl.replaceAll('{param}', param ?? 'N')
  return tpl
}

export function keywordRuleRef(ruleSnippet: string | undefined, lookupPath: (path: string) => string): string | undefined {
  if (!ruleSnippet) return undefined
  if (ruleSnippet === 'Regla oficial de MTG.') return lookupPath('wiki.rule_official')
  if (ruleSnippet === 'Palabra de Habilidad oficial de MTG.') return lookupPath('wiki.rule_ability_word')
  return ruleSnippet
}
