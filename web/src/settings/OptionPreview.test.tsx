import { describe, expect, it, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import OptionPreview from './OptionPreview'

afterEach(() => cleanup())

const thumb = (kind: string) => screen.getByTestId(`option-preview-${kind}-on`)

describe('the thumbnail beside a board setting', () => {
  it('BRD-6: the side panel is drawn at the left edge, where the panel is', () => {
    render(<OptionPreview kind="boardSpotlight" on />)
    const spot = thumb('boardSpotlight').querySelector('.opt-preview-spot') as HTMLElement
    expect(spot).not.toBeNull()
    const parts = Array.from(spot.children).map((el) => el.className)
    expect(parts[0], 'the panel is the first column').toContain('opt-preview-spot-panel')
    expect(parts[1], 'the board that keeps its size follows it').toContain('opt-preview-spot-main')
  })

  it('SET-16: the fan draws its cards leaning out from the middle, which is what tells it from the row', () => {
    render(<OptionPreview kind="handFan" on />)
    const cards = Array.from(thumb('handFan').querySelectorAll('.opt-preview-fan-card')) as HTMLElement[]
    expect(cards.length).toBeGreaterThan(2)
    const turns = cards.map((c) => c.style.getPropertyValue('--fan-rot'))
    expect(new Set(turns).size, 'every card leans by its own amount').toBe(turns.length)
    expect(turns.some((t) => t.startsWith('-')), 'some lean one way').toBe(true)
    expect(turns.some((t) => !t.startsWith('-') && !t.startsWith('0')), 'and some the other').toBe(true)
  })

  it('SET-16: the three hand thumbnails are three different drawings', () => {
    const drawn: string[] = []
    for (const kind of ['handFan', 'handRail', 'handRow'] as const) {
      render(<OptionPreview kind={kind} on />)
      drawn.push(thumb(kind).innerHTML)
      cleanup()
    }
    expect(new Set(drawn).size).toBe(drawn.length)
  })
})
