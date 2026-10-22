import { describe, expect, it } from 'vitest'
import { SPOTLIGHT_PANEL_DEFAULT, SPOTLIGHT_PANEL_MAX, SPOTLIGHT_PANEL_MIN, normalizeBoardSpotlight, normalizeBoardSpotlightPanel, normalizeKeywordAuraMode, normalizePtBadgeMode, normalizeShowHandCost, normalizeShowManaSource, normalizeSicknessStyle } from './cardOverlays'

describe('normalizeShowHandCost', () => {
  it('defaults to true for a missing or non-boolean value', () => {
    expect(normalizeShowHandCost(undefined)).toBe(true)
    expect(normalizeShowHandCost(null)).toBe(true)
    expect(normalizeShowHandCost('false')).toBe(true)
    expect(normalizeShowHandCost(0)).toBe(true)
    expect(normalizeShowHandCost({})).toBe(true)
  })

  it('keeps an explicit false', () => {
    expect(normalizeShowHandCost(false)).toBe(false)
  })

  it('keeps an explicit true', () => {
    expect(normalizeShowHandCost(true)).toBe(true)
  })
})
describe('board spotlight flag', () => {
  it('BRD-6: boardSpotlight is off unless stored as true', () => {
    expect(normalizeBoardSpotlight(undefined)).toBe(false)
    expect(normalizeBoardSpotlight(null)).toBe(false)
    expect(normalizeBoardSpotlight('true')).toBe(false)
    expect(normalizeBoardSpotlight(1)).toBe(false)
    expect(normalizeBoardSpotlight(false)).toBe(false)
    expect(normalizeBoardSpotlight(true)).toBe(true)
  })
})

describe('board spotlight panel width', () => {
  it('BRD-13: the panel width is clamped between 15 and 35 percent and is 22 by default', () => {
    expect(SPOTLIGHT_PANEL_MIN).toBe(15)
    expect(SPOTLIGHT_PANEL_MAX).toBe(35)
    expect(SPOTLIGHT_PANEL_DEFAULT).toBe(22)
    expect(normalizeBoardSpotlightPanel(undefined)).toBe(22)
    expect(normalizeBoardSpotlightPanel('30')).toBe(22)
    expect(normalizeBoardSpotlightPanel(NaN)).toBe(22)
    expect(normalizeBoardSpotlightPanel(Infinity)).toBe(22)
    expect(normalizeBoardSpotlightPanel(5)).toBe(15)
    expect(normalizeBoardSpotlightPanel(90)).toBe(35)
    expect(normalizeBoardSpotlightPanel(27.6)).toBe(28)
    expect(normalizeBoardSpotlightPanel(18.4)).toBe(18)
  })
})

describe('normalizePtBadgeMode', () => {
  it('falls back to always for a missing or invalid mode', () => {
    expect(normalizePtBadgeMode(undefined)).toBe('always')
    expect(normalizePtBadgeMode('sometimes')).toBe('always')
    expect(normalizePtBadgeMode(7)).toBe('always')
    expect(normalizePtBadgeMode(null)).toBe('always')
  })

  it('keeps each valid mode', () => {
    expect(normalizePtBadgeMode('always')).toBe('always')
    expect(normalizePtBadgeMode('changed')).toBe('changed')
    expect(normalizePtBadgeMode('hidden')).toBe('hidden')
  })
})

describe('normalizeSicknessStyle', () => {
  it('falls back to badge for a missing or unknown style', () => {
    expect(normalizeSicknessStyle(undefined)).toBe('badge')
    expect(normalizeSicknessStyle('hourglass')).toBe('badge')
    expect(normalizeSicknessStyle(3)).toBe('badge')
    expect(normalizeSicknessStyle(null)).toBe('badge')
  })

  it('keeps each valid style', () => {
    expect(normalizeSicknessStyle('badge')).toBe('badge')
    expect(normalizeSicknessStyle('veil')).toBe('veil')
  })
})

describe('normalizeShowManaSource', () => {
  it('is off unless explicitly enabled', () => {
    expect(normalizeShowManaSource(undefined)).toBe(false)
    expect(normalizeShowManaSource('true')).toBe(false)
    expect(normalizeShowManaSource(1)).toBe(false)
    expect(normalizeShowManaSource(false)).toBe(false)
    expect(normalizeShowManaSource(true)).toBe(true)
  })
})

describe('normalizeKeywordAuraMode', () => {
  it('keeps each valid mode', () => {
    expect(normalizeKeywordAuraMode('off')).toBe('off')
    expect(normalizeKeywordAuraMode('subtle')).toBe('subtle')
    expect(normalizeKeywordAuraMode('vivid')).toBe('vivid')
  })

  it('falls back to subtle for a missing or invalid mode', () => {
    expect(normalizeKeywordAuraMode(undefined)).toBe('subtle')
    expect(normalizeKeywordAuraMode('loud')).toBe('subtle')
    expect(normalizeKeywordAuraMode(1)).toBe('subtle')
  })
})
