import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import Attribution from './Attribution'

const twemojiLink = () => document.querySelector('a[href="https://github.com/twitter/twemoji"]')

afterEach(() => cleanup())

describe('Attribution', () => {
  it('APR-4: the page footer credits Scryfall and XMage, and leaves the flags credit to About', () => {
    render(<Attribution />)
    expect(document.querySelector('a[href="https://scryfall.com"]')).not.toBeNull()
    expect(document.querySelector('a[href="https://github.com/magefree/mage"]')).not.toBeNull()
    expect(twemojiLink()).toBeNull()
  })

  it('APR-4: About credits the Twemoji flags', () => {
    render(<Attribution withFlags />)
    expect(twemojiLink()).not.toBeNull()
  })
})
