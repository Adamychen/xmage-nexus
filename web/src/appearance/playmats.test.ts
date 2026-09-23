import { describe, expect, it } from 'vitest'
import { normalizePlaymat, PLAYMATS } from './playmats'
import { identityColors, playmatVars } from './playmatIdentity'
import { makeGameView, makePermanent, makePlayer } from '../__fixtures__/gameViews'

describe('playmats', () => {
  it('normalizes unknown ids to the classic mat', () => {
    expect(normalizePlaymat('ember')).toBe('ember')
    expect(normalizePlaymat('nope')).toBe('classic')
    expect(normalizePlaymat(undefined)).toBe('classic')
    expect(PLAYMATS.filter((m) => m.animated).map((m) => m.id)).toEqual(['aurora', 'identity'])
  })

  it('derives colours from basic lands and coloured permanents, most frequent first', () => {
    const me = makePlayer({
      playerId: 'me',
      name: 'Me',
      controlled: true,
      battlefield: {
        a: makePermanent({ id: 'a', name: 'Mountain' }),
        b: makePermanent({ id: 'b', name: 'Mountain' }),
        c: makePermanent({ id: 'c', name: 'Forest' }),
        d: makePermanent({ id: 'd', name: 'Goblin Guide', color: { red: true } }),
        e: makePermanent({ id: 'e', name: 'Sol Ring' }),
      },
    })
    expect(identityColors(makeGameView({ players: [me] }))).toEqual(['r', 'g'])
  })

  it('returns no colours without players', () => {
    expect(identityColors(null)).toEqual([])
  })

  it('maps colours to mana tokens with brand fallbacks', () => {
    expect(playmatVars(['g'])).toEqual({
      '--mat-a-rgb': 'var(--mana-g-rgb)',
      '--mat-b-rgb': 'var(--mana-g-rgb)',
      '--mat-c-rgb': 'var(--mana-g-rgb)',
    })
    expect(playmatVars([])['--mat-a-rgb']).toBe('var(--brand-rgb)')
  })
})
