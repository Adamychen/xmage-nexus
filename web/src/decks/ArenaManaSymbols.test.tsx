import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { parseManaSymbols, symbolToSvgPath, ManaPip, ManaCost } from './ArenaManaSymbols'

describe('ArenaManaSymbols', () => {
  describe('symbolToSvgPath', () => {
    it('maps color letters to SVG files', () => {
      expect(symbolToSvgPath('W')).toBe('/symbols/W.svg')
      expect(symbolToSvgPath('{U}')).toBe('/symbols/U.svg')
      expect(symbolToSvgPath('{B}')).toBe('/symbols/B.svg')
      expect(symbolToSvgPath('R')).toBe('/symbols/R.svg')
      expect(symbolToSvgPath('{G}')).toBe('/symbols/G.svg')
      expect(symbolToSvgPath('C')).toBe('/symbols/C.svg')
    })

    it('maps numbers and special symbols', () => {
      expect(symbolToSvgPath('0')).toBe('/symbols/0.svg')
      expect(symbolToSvgPath('{1}')).toBe('/symbols/1.svg')
      expect(symbolToSvgPath('{15}')).toBe('/symbols/15.svg')
      expect(symbolToSvgPath('X')).toBe('/symbols/X.svg')
      expect(symbolToSvgPath('{T}')).toBe('/symbols/T.svg')
      expect(symbolToSvgPath('{Q}')).toBe('/symbols/Q.svg')
      expect(symbolToSvgPath('{E}')).toBe('/symbols/E.svg')
      expect(symbolToSvgPath('{S}')).toBe('/symbols/S.svg')
      expect(symbolToSvgPath('{∞}')).toBe('/symbols/INFINITY.svg')
      expect(symbolToSvgPath('{1/2}')).toBe('/symbols/HALF.svg')
    })

    it('maps hybrid and phyrexian symbols', () => {
      expect(symbolToSvgPath('{W/U}')).toBe('/symbols/WU.svg')
      expect(symbolToSvgPath('{2/R}')).toBe('/symbols/2R.svg')
      expect(symbolToSvgPath('{W/P}')).toBe('/symbols/WP.svg')
      expect(symbolToSvgPath('{G/W/P}')).toBe('/symbols/GWP.svg')
    })
  })

  describe('parseManaSymbols', () => {
    it('parses braces-formatted costs', () => {
      expect(parseManaSymbols('{1}{U}{B}')).toEqual(['1', 'U', 'B'])
      expect(parseManaSymbols('{2/R}{G/W}')).toEqual(['2/R', 'G/W'])
      expect(parseManaSymbols('{X}{W/P}')).toEqual(['X', 'W/P'])
    })

    it('parses raw non-braced costs', () => {
      expect(parseManaSymbols('2UU')).toEqual(['2', 'U', 'U'])
      expect(parseManaSymbols('1RG')).toEqual(['1', 'R', 'G'])
    })

    it('returns empty array on empty input', () => {
      expect(parseManaSymbols('')).toEqual([])
      expect(parseManaSymbols(undefined)).toEqual([])
    })
  })

  describe('ManaPip component', () => {
    it('renders an img with correct src and alt', () => {
      const { container } = render(<ManaPip symbol="{R}" size={20} />)
      const img = container.querySelector('img.mana-symbol-svg') as HTMLImageElement
      expect(img).toBeTruthy()
      expect(img.getAttribute('src')).toBe('/symbols/R.svg')
      expect(img.getAttribute('alt')).toBe('{R}')
      expect(img.style.width).toBe('20px')
      expect(img.style.height).toBe('20px')
    })
  })

  describe('ManaCost component', () => {
    it('renders multiple pips', () => {
      const { container } = render(<ManaCost manaCost="{1}{U}{B}" size={16} />)
      const imgs = container.querySelectorAll('img.mana-symbol-svg')
      expect(imgs.length).toBe(3)
      expect(imgs[0].getAttribute('src')).toBe('/symbols/1.svg')
      expect(imgs[1].getAttribute('src')).toBe('/symbols/U.svg')
      expect(imgs[2].getAttribute('src')).toBe('/symbols/B.svg')
    })

    it('returns null if manaCost is empty', () => {
      const { container } = render(<ManaCost manaCost="" />)
      expect(container.firstChild).toBeNull()
    })
  })
})
