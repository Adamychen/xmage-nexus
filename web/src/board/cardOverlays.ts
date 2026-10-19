/**
 * Normalizers for the board overlay presentation flags (issue #12). They live
 * next to the feature, not in `persistence.ts`, because `persistence` imports
 * them — same pattern as `normalizeCardStyle` / `normalizeTapStyle`.
 */

export function normalizeShowHandCost(value: unknown): boolean {
  return typeof value === 'boolean' ? value : true
}

export function normalizeShowManaSource(value: unknown): boolean {
  return value === true
}

export type PtBadgeMode = 'always' | 'changed' | 'hidden'

export const PT_BADGE_MODES: readonly PtBadgeMode[] = ['always', 'changed', 'hidden']

export function normalizePtBadgeMode(value: unknown): PtBadgeMode {
  return PT_BADGE_MODES.includes(value as PtBadgeMode) ? (value as PtBadgeMode) : 'always'
}

export type SicknessStyle = 'badge' | 'veil'

export const SICKNESS_STYLES: readonly SicknessStyle[] = ['badge', 'veil']

export function normalizeSicknessStyle(value: unknown): SicknessStyle {
  return SICKNESS_STYLES.includes(value as SicknessStyle) ? (value as SicknessStyle) : 'badge'
}

export type KeywordIconSet = 'coins' | 'outline'

export const KEYWORD_ICON_SETS: readonly KeywordIconSet[] = ['coins', 'outline']

export function normalizeKeywordIconSet(value: unknown): KeywordIconSet {
  return KEYWORD_ICON_SETS.includes(value as KeywordIconSet) ? (value as KeywordIconSet) : 'coins'
}
export type CardRender = 'image' | 'rendered'

export const CARD_RENDERS: readonly CardRender[] = ['image', 'rendered']

export function normalizeCardRender(value: unknown): CardRender {
  return CARD_RENDERS.includes(value as CardRender) ? (value as CardRender) : 'image'
}

export function normalizeHandRail(value: unknown): boolean {
  return value === true
}

export function normalizeHandRow(value: unknown): boolean {
  return value === true
}

export const HAND_RAIL_MIN_W = 120
export const HAND_RAIL_MAX_W = 460
export const HAND_RAIL_DEFAULT_W = 260

export function normalizeHandRailWidth(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return HAND_RAIL_DEFAULT_W
  return Math.min(HAND_RAIL_MAX_W, Math.max(HAND_RAIL_MIN_W, Math.round(n)))
}

export function normalizeBoardFill(value: unknown): boolean {
  return typeof value === 'boolean' ? value : true
}

export function normalizeStackCaption(value: unknown): boolean {
  return typeof value === 'boolean' ? value : true
}
