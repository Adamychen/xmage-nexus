import { afterEach, describe, expect, it } from 'vitest'
import { overlayRoot } from './overlayRoot'

afterEach(() => {
  document.querySelectorAll('[data-overlay-root]').forEach((el) => el.remove())
})

describe('overlayRoot', () => {
  it('falls back to document.body without a gallery host', () => {
    expect(overlayRoot()).toBe(document.body)
  })

  it('prefers the [data-overlay-root] host when the gallery provides one', () => {
    const host = document.createElement('div')
    host.setAttribute('data-overlay-root', '')
    document.body.appendChild(host)
    expect(overlayRoot()).toBe(host)
  })
})
