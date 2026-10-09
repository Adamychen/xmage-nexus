/**
 * Normalizers for the board overlay presentation flags (issue #12). They live
 * next to the feature, not in `persistence.ts`, because `persistence` imports
 * them — same pattern as `normalizeCardStyle` / `normalizeTapStyle`.
 */

export function normalizeShowHandCost(value: unknown): boolean {
  return typeof value === 'boolean' ? value : true
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