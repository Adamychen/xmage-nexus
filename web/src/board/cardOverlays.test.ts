import { describe, expect, it } from 'vitest'
import { normalizePtBadgeMode, normalizeShowHandCost, normalizeSicknessStyle } from './cardOverlays'

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
