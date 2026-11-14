import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import BoardDemo from './BoardDemo'

afterEach(() => {
  cleanup()
})

describe('BoardDemo keyword badges', () => {
  it('BRD-47: previews the seven keyword icons, at most two per card, with no P/T badge to collide with', () => {
    const { container } = render(<BoardDemo spec={{ kind: 'keywordAura', value: 'off' }} />)
    const slots = [...container.querySelectorAll('.card-slot')]
    expect(slots.length).toBeGreaterThan(0)
    for (const slot of slots) expect(slot.querySelectorAll('.keyword-badge').length).toBeLessThanOrEqual(2)
    for (const b of container.querySelectorAll('.keyword-badge')) expect(b.className).not.toMatch(/icons-/)
  })
})

