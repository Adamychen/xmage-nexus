import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import BoardDemo from './BoardDemo'

afterEach(() => {
  cleanup()
})

describe('BoardDemo keywordIcons', () => {
  it('previews all seven keyword icons, at most two per card, with no P/T badge to collide with', () => {
    for (const set of ['coins', 'outline'] as const) {
      const { container, unmount } = render(<BoardDemo spec={{ kind: 'keywordIcons', value: set }} />)
      const slots = [...container.querySelectorAll('.card-slot')]
      expect(slots.length).toBeGreaterThan(0)
      for (const slot of slots) expect(slot.querySelectorAll('.keyword-badge').length).toBeLessThanOrEqual(2)
      const ids = [...container.querySelectorAll('.keyword-badge')].map((b) => [...b.classList].find((c) => c.startsWith('kw-') && c !== 'kw-coin' && c !== 'kw-gained'))
      expect(new Set(ids)).toEqual(new Set(['kw-flying', 'kw-haste', 'kw-deathtouch', 'kw-lifelink', 'kw-trample', 'kw-hexproof', 'kw-indestructible']))
      for (const b of container.querySelectorAll('.keyword-badge')) expect(b.classList.contains(`icons-${set}`)).toBe(true)
      expect(container.querySelector('[data-badge-zone="stats"]')).toBeNull()
      unmount()
    }
  })
})
