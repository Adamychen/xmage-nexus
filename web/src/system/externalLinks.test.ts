import { afterEach, describe, expect, it, vi } from 'vitest'
import { externalHref, installExternalLinks } from './externalLinks'

function link(href: string, target?: string): HTMLAnchorElement {
  const a = document.createElement('a')
  a.href = href
  if (target) a.target = target
  a.textContent = 'x'
  document.body.appendChild(a)
  return a
}

afterEach(() => {
  document.body.innerHTML = ''
  delete (window as unknown as { __TAURI__?: unknown }).__TAURI__
})

describe('externalHref', () => {
  it('returns the href of a new-tab web link, also from a nested element', () => {
    const a = link('https://scryfall.com/', '_blank')
    const span = document.createElement('span')
    a.appendChild(span)
    expect(externalHref(span)).toBe('https://scryfall.com/')
  })

  it('ignores same-origin links without a new-tab target', () => {
    expect(externalHref(link('#/gallery'))).toBeNull()
  })

  it('ignores non-web schemes and non-link targets', () => {
    expect(externalHref(link('javascript:void(0)', '_blank'))).toBeNull()
    expect(externalHref(document.body)).toBeNull()
  })
})

describe('installExternalLinks', () => {
  it('opens new-tab links through the desktop opener when running in the app', () => {
    const invoke = vi.fn().mockResolvedValue(undefined)
    ;(window as unknown as { __TAURI__: unknown }).__TAURI__ = { core: { invoke } }
    installExternalLinks()
    const a = link('https://github.com/magefree/mage', '_blank')
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })
    a.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
    expect(invoke).toHaveBeenCalledWith('plugin:opener|open_url', { url: 'https://github.com/magefree/mage' })
  })
})
