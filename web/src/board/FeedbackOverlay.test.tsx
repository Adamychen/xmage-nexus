import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import FeedbackOverlay from './FeedbackOverlay'
import { announceBanner, clearFeedbackFx } from './feedbackFx'

afterEach(() => {
  clearFeedbackFx()
  cleanup()
})

describe('the turn announcement over the board', () => {
  it("FX-10: the label goes above the name, so the band reads 'Turno de' then who", () => {
    announceBanner('Pablo', 'Turno de')
    const { getByTestId } = render(<FeedbackOverlay />)
    const banner = getByTestId('fx-banner')
    const parts = Array.from(banner.querySelectorAll('.fx-banner-sub, .fx-banner-text'))
    expect(parts.map((el) => el.textContent)).toEqual(['Turno de', 'Pablo'])
    expect(banner.hasAttribute('data-own')).toBe(false)
  })

  it('FX-10: my own turn carries the mark the gold is painted from, and no label', () => {
    announceBanner('Tu turno', undefined, { own: true })
    const { getByTestId } = render(<FeedbackOverlay />)
    const banner = getByTestId('fx-banner')
    expect(banner.getAttribute('data-own')).toBe('1')
    expect(banner.querySelector('.fx-banner-sub')).toBeNull()
    expect(banner.querySelector('.fx-banner-text')?.textContent).toBe('Tu turno')
  })

  it('FX-10: the band spans the screen and lets every click through to the board', () => {
    announceBanner('Pablo', 'Turno de')
    const { getByTestId, container } = render(<FeedbackOverlay />)
    expect(getByTestId('fx-banner').querySelector('.fx-banner-sweep')).not.toBeNull()
    expect(container.querySelector('.feedback-overlay')?.getAttribute('aria-hidden')).toBe('true')
  })
})
