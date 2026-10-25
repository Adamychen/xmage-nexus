import { afterEach, describe, expect, it } from 'vitest'
import { overlayRoot } from './overlayRoot'

afterEach(() => {
  document.querySelectorAll('[data-overlay-root]').forEach((el) => el.remove())
})

describe('overlayRoot', () => {
  it('falls back to a board-surface wrapper appended to document.body without a gallery host', () => {
    const root = overlayRoot()
    expect(root.tagName).toBe('DIV')
    expect(root.classList.contains('board-surface')).toBe(true)
    expect(root.parentElement).toBe(document.body)
  })

  it('prefers the [data-overlay-root] host when the gallery provides one', () => {
    const host = document.createElement('div')
    host.setAttribute('data-overlay-root', '')
    document.body.appendChild(host)
    expect(overlayRoot()).toBe(host)
  })
})
