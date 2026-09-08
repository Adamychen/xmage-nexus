import type { CardView, PermanentView } from '../net/types'
import { MTG_KEYWORDS, type MtgKeyword } from './mtgKeywords'

export interface DetectedKeyword {
  id: string
  name: string
  icon: string
  category: MtgKeyword['category']
  ruleSnippet?: string
  parameter?: string
}

/**
 * Normalizes rule text and extracts matching MTG keywords from a card's rules,
 * abilities, and sub-abilities.
 */
export function extractKeywordsFromCard(card: CardView | PermanentView | null): DetectedKeyword[] {
  if (!card) return []

  const textLines: string[] = []

  // Collect text lines from rules
  if (Array.isArray(card.rules)) {
    textLines.push(...card.rules)
  }

  // Collect text from abilities if present
  if (Array.isArray((card as any).abilities)) {
    for (const ab of (card as any).abilities) {
      if (typeof ab === 'string') textLines.push(ab)
      else if (ab && typeof ab.rule === 'string') textLines.push(ab.rule)
    }
  }

  if (textLines.length === 0) return []

  const combinedText = textLines.join('\n')
  const detected: DetectedKeyword[] = []
  const seenIds = new Set<string>()

  for (const kw of MTG_KEYWORDS) {
    if (kw.parameterRegex) {
      const match = combinedText.match(kw.parameterRegex)
      if (match) {
        const param = match[1]?.trim()
        let customName = kw.name

        if (param) {
          if (kw.id === 'ward') {
            customName = `Ward ${param}`
          } else if (kw.id === 'protection') {
            customName = `Protection from ${param}`
          } else if (kw.id === 'scry') {
            customName = `Scry ${param}`
          } else if (kw.id === 'surveil') {
            customName = `Surveil ${param}`
          } else if (kw.id === 'mill') {
            customName = `Mill ${param}`
          } else if (kw.id === 'toxic') {
            customName = `Toxic ${param}`
          } else if (kw.id === 'dredge') {
            customName = `Dredge ${param}`
          }
        }

        if (!seenIds.has(kw.id)) {
          seenIds.add(kw.id)
          detected.push({
            id: kw.id,
            name: customName,
            icon: kw.icon,
            category: kw.category,
            ruleSnippet: kw.ruleSnippet,
            parameter: param,
          })
        }
        continue
      }
    }

    // Exact word boundary matching (e.g. \bFlying\b, \bTrample\b, \bVigilance\b)
    const escapedName = kw.name.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')
    const regex = new RegExp(`\\b${escapedName}\\b`, 'i')

    if (regex.test(combinedText) && !seenIds.has(kw.id)) {
      seenIds.add(kw.id)
      detected.push({
        id: kw.id,
        name: kw.name,
        icon: kw.icon,
        category: kw.category,
        ruleSnippet: kw.ruleSnippet,
      })
    }
  }

  return detected
}
