import { render, cleanup } from '@testing-library/react'
import { describe, expect, it, afterEach } from 'vitest'
import DeckHoverPreview, { hoverPreviewFaceWidth, hoverPreviewPosition } from './DeckHoverPreview'

function setViewport(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: height })
}

function rectAt(left: number, top: number): DOMRect {
  return { left, top, right: left + 120, bottom: top + 168, width: 120, height: 168, x: left, y: top, toJSON: () => ({}) } as DOMRect
}

describe('DeckHoverPreview', () => {
  afterEach(() => cleanup())

  it.each([
    [1920, 1080],
    [1366, 768],
    [1280, 720],
  ])('DCK-3: at %ix%i the preview stays inside the window wherever the hovered card is', (w, h) => {
    setViewport(w, h)
    const face = hoverPreviewFaceWidth()
    for (const dual of [false, true]) {
      const width = dual ? face * 2 + 16 : face
      const height = (face * 3.5) / 2.5
      for (const rect of [rectAt(20, 20), rectAt(w - 140, h - 180), rectAt(w / 2 - 60, h / 2), rectAt(w / 2 + 10, 40)]) {
        const { x, y } = hoverPreviewPosition(rect, dual)
        expect(x).toBeGreaterThanOrEqual(0)
        expect(y).toBeGreaterThanOrEqual(0)
        expect(x + width).toBeLessThanOrEqual(w)
        expect(y + height).toBeLessThanOrEqual(h)
      }
    }
  })

  it('DCK-3: a card on the left half opens the preview to its right without covering it', () => {
    setViewport(1920, 1080)
    const rect = rectAt(300, 300)
    expect(hoverPreviewPosition(rect, false).x).toBeGreaterThanOrEqual(rect.right)
  })

  it('DCK-3: a card on the right half opens the preview to its left without covering it', () => {
    setViewport(1920, 1080)
    const rect = rectAt(1500, 300)
    const { x } = hoverPreviewPosition(rect, false)
    expect(x + hoverPreviewFaceWidth()).toBeLessThanOrEqual(rect.left)
  })

  it('DCK-3: renders both faces of a double-faced card', () => {
    const { container } = render(<DeckHoverPreview preview={{ url: 'front.jpg', backUrl: 'back.jpg', x: 0, y: 0, name: 'Delver of Secrets' }} />)
    expect(container.querySelectorAll('.preview-face-card img')).toHaveLength(2)
    expect(container.querySelector('.arena-floating-preview')?.classList.contains('has-back-face')).toBe(true)
  })
})
