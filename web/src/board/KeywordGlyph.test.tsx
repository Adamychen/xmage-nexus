import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import KeywordGlyph, { KeywordCoin } from './KeywordGlyph'

describe('KeywordGlyph', () => {
  it('draws solid keywords from the legacy set in both icon sets', () => {
    expect(render(<KeywordGlyph id="flying" category="evasion" set="coins" />).container.querySelector('svg[fill="currentColor"]')).not.toBeNull()
    expect(render(<KeywordGlyph id="flying" category="evasion" set="outline" />).container.querySelector('svg[stroke="currentColor"]')).not.toBeNull()
  })

  it('draws registry keywords as stroked nodes', () => {
    const { container } = render(<KeywordGlyph id="menace" category="evasion" set="coins" />)
    expect(container.querySelectorAll('svg circle')).toHaveLength(2)
  })

  it('resolves aliases to the shared glyph', () => {
    const a = render(<KeywordGlyph id="plainswalk" category="evasion" set="coins" />).container.innerHTML
    const b = render(<KeywordGlyph id="landwalk" category="evasion" set="coins" />).container.innerHTML
    expect(a).toBe(b)
  })

  it('sizes the coin from the size prop and tints it by keyword', () => {
    const { container } = render(<KeywordCoin id="mutate" category="mechanic" size={30} set="coins" />)
    const coin = container.querySelector('.kw-coin') as HTMLElement
    expect(coin.style.getPropertyValue('--kw-size')).toBe('30px')
    expect(coin.classList.contains('kw-mutate')).toBe(true)
  })
})
