// @vitest-environment jsdom
import { describe, expect, it, afterEach } from 'vitest'
import { artDebugOn, printedAs } from './artDebug'

const withSearch = (search: string) => {
  window.history.replaceState({}, '', `/${search}`)
}

describe('CRD-9: the art key caption', () => {
  afterEach(() => withSearch(''))

  it('CRD-9: is off unless the URL asks for it', () => {
    expect(artDebugOn()).toBe(false)
    withSearch('?other=1')
    expect(artDebugOn()).toBe(false)
    withSearch('?artdebug=1')
    expect(artDebugOn()).toBe(true)
    withSearch('?artdebug')
    expect(artDebugOn()).toBe(true)
  })

  it('CRD-9: prints what the server sent, and says so when it sent nothing', () => {
    expect(printedAs({ expansionSetCode: 'SLD', cardNumber: '1869' })).toBe('SLD/1869')
    expect(printedAs({ expansionSetCode: '', cardNumber: '0' })).toBe('-/0')
    expect(printedAs({})).toBe('-')
  })
})
