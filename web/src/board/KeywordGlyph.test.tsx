import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import KeywordGlyph, { KeywordCoin } from './KeywordGlyph'

describe('KeywordGlyph', () => {
  it('BRD-47: draws the official symbol of a keyword that ships one, as a masked file', () => {
    for (const id of ['flying', 'deathtouch', 'lifelink', 'vigilance']) {
      const art = render(<KeywordGlyph id={id} category="evasion" />).container.querySelector<HTMLElement>('.kw-art')
      expect(art, id).not.toBeNull()
      expect(art?.style.getPropertyValue('--kw-art')).toContain(`symbols/abilities/${id}.svg`)
    }
  })

  it('BRD-47: falls back to the drawn glyph for a keyword with no official symbol', () => {
    const { container } = render(<KeywordGlyph id="shadow" category="evasion" />)
    expect(container.querySelector('.kw-art')).toBeNull()
    expect(container.querySelector('svg')).not.toBeNull()
  })

  it('draws registry keywords as stroked nodes', () => {
    // A keyword the official set has no symbol for keeps the drawn glyph.
    const { container } = render(<KeywordGlyph id="landwalk" category="evasion" />)
    expect(container.querySelector('svg[stroke="currentColor"]')).not.toBeNull()
  })

  it('resolves aliases to the shared glyph', () => {
    const a = render(<KeywordGlyph id="plainswalk" category="evasion" />).container.innerHTML
    const b = render(<KeywordGlyph id="landwalk" category="evasion" />).container.innerHTML
    expect(a).toBe(b)
  })

  it('sizes the coin from the size prop and tints it by keyword', () => {
    const { container } = render(<KeywordCoin id="mutate" category="mechanic" size={30} />)
    const coin = container.querySelector('.kw-coin') as HTMLElement
    expect(coin.style.getPropertyValue('--kw-size')).toBe('30px')
    expect(coin.classList.contains('kw-mutate')).toBe(true)
  })
})
