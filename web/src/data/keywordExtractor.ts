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

function cardTextLines(card: CardView | PermanentView): string[] {
  const textLines: string[] = []

  if (Array.isArray(card.rules)) {
    textLines.push(...card.rules)
  }

  if (Array.isArray((card as any).abilities)) {
    for (const ab of (card as any).abilities) {
      if (typeof ab === 'string') textLines.push(ab)
      else if (ab && typeof ab.rule === 'string') textLines.push(ab.rule)
    }
  }

  return textLines
}

const escapeRegex = (s: string) => s.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')

const KEYWORD_ITEM = new RegExp(
  `^(?:${MTG_KEYWORDS.filter((k) => k.type === 'ability')
    .map((k) => escapeRegex(k.name))
    .sort((a, b) => b.length - a.length)
    .join('|')})\\b`,
  'i',
)

/**
 * Keeps only the items of keyword-ability lines ("Flying, vigilance",
 * "Ward {2} (reminder)", "Protection from red"). Lines that merely mention a
 * keyword ("can't be blocked except by creatures with flying or reach",
 * "create a token with vigilance") are not abilities the object has.
 */
function keywordAbilityItems(textLines: string[]): string[] {
  const items: string[] = []
  for (const line of textLines) {
    const bare = line
      .replace(/\([^)]*\)/g, '')
      .replace(/<[^>]+>/g, '')
      .trim()
      .replace(/\.$/, '')
    if (!bare) continue
    const parts = bare.split(/\s*[,;]\s*/).filter(Boolean)
    if (parts.length > 0 && parts.every((p) => KEYWORD_ITEM.test(p))) items.push(...parts)
  }
  return items
}

/**
 * Normalizes rule text and extracts matching MTG keywords from a card's rules,
 * abilities, and sub-abilities. Includes keywords that are only referenced by
 * the text (glossary use); see `extractOwnedKeywords` for the abilities the
 * object actually has.
 */
export function extractKeywordsFromCard(card: CardView | PermanentView | null): DetectedKeyword[] {
  if (!card) return []
  return detectKeywords(cardTextLines(card), false)
}

/**
 * Keyword abilities the object actually has: only keyword-ability lines count,
 * so a keyword named inside another ability's text is ignored.
 */
export function extractOwnedKeywords(card: CardView | PermanentView | null): DetectedKeyword[] {
  if (!card) return []
  return detectKeywords(keywordAbilityItems(cardTextLines(card)), true)
}

function detectKeywords(textLines: string[], anchored: boolean): DetectedKeyword[] {
  if (textLines.length === 0) return []

  const combinedText = textLines.join('\n')
  const detected: DetectedKeyword[] = []
  const seenIds = new Set<string>()

  for (const kw of MTG_KEYWORDS) {
    if (anchored && kw.type !== 'ability') continue
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
    const escapedName = escapeRegex(kw.name)
    const regex = anchored ? new RegExp(`^${escapedName}\\b`, 'im') : new RegExp(`\\b${escapedName}\\b`, 'i')

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
