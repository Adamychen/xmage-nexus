import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'

const polyfill = vi.hoisted(() => vi.fn(() => true))
vi.mock('country-flag-emoji-polyfill', () => ({ polyfillCountryFlagEmojis: polyfill }))

import { FLAG_FONT, installFlagEmojiFont } from './flagEmoji'

const css = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8')
const fontStack = (source: string, token: string) => new RegExp(`${token}:\\s*([^;]+);`).exec(source)?.[1] ?? ''

describe('flag emoji font', () => {
  it('APR-4: loads the flag font from the app itself, not from a CDN', () => {
    expect(installFlagEmojiFont()).toBe(true)
    expect(polyfill).toHaveBeenCalledOnce()
    const [name, url] = polyfill.mock.calls[0] as unknown as [string, string]
    expect(name).toBe(FLAG_FONT)
    expect(url).toMatch(/TwemojiCountryFlags.*\.woff2/)
    expect(url).not.toMatch(/^https?:/)
  })

  it('APR-4: the interface and display font stacks try the flag font first', () => {
    expect(fontStack(css('../ui/tokens.css'), '--font-ui').startsWith(`'${FLAG_FONT}'`)).toBe(true)
    expect(fontStack(css('../styles.css'), '--font-display').startsWith(`'${FLAG_FONT}'`)).toBe(true)
  })
})
