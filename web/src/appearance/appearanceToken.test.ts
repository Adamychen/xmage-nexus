import { describe, expect, it } from 'vitest'
import { APPEARANCE_TOKEN_MAX, buildAppearanceToken, parseAppearanceToken } from './appearanceToken'
import { declaredSleeveOf, resolveSleeveFor } from './useSleeve'

const gameWith = (userIdStr: unknown) => ({
  myPlayerId: 'me',
  players: [
    { playerId: 'me', controlled: true },
    { playerId: 'rival', userData: { userIdStr } },
  ],
})

describe('the appearance a player declares to the table', () => {
  it('APR-6: a catalogue sleeve makes a token and comes back out of it', () => {
    expect(buildAppearanceToken({ sleeveId: 'nebula' })).toBe('nxs1;slv=nebula')
    expect(parseAppearanceToken('nxs1;slv=nebula')).toEqual({ sleeveId: 'nebula' })
  })

  it('APR-6: a sleeve only its owner can draw declares nothing', () => {
    expect(buildAppearanceToken({ sleeveId: 'custom' })).toBe('')
    expect(buildAppearanceToken({ sleeveId: null })).toBe('')
    expect(parseAppearanceToken('nxs1;slv=custom').sleeveId).toBeNull()
  })

  it('APR-6: anything the client did not write reads as no declaration', () => {
    for (const raw of [
      undefined,
      null,
      42,
      '',
      'user:Windows 11:mage-proxy',
      'nxs1',
      'nxs1;slv=',
      'nxs1;slv=from-a-newer-catalogue',
      'nxs2;slv=nebula',
      `nxs1;slv=${'n'.repeat(APPEARANCE_TOKEN_MAX)}`,
    ]) {
      expect(parseAppearanceToken(raw).sleeveId, String(raw)).toBeNull()
    }
  })

  it('APR-6: a declaration is read off the player view, by player', () => {
    expect(declaredSleeveOf(gameWith('nxs1;slv=wood'), 'rival')).toBe('wood')
    expect(declaredSleeveOf(gameWith('nxs1;slv=wood'), 'me')).toBe('')
    expect(declaredSleeveOf(gameWith('nxs1;slv=wood'), 'someone-who-left')).toBe('')
    expect(declaredSleeveOf(null, 'rival')).toBe('')
  })

  it('APR-6: my own choice is mine, and a table that declares nothing stays classic', () => {
    expect(resolveSleeveFor('me', 'me', 'midnight', null, '').id).toBe('midnight')
    // my custom image is mine alone: it never follows my id onto anyone else's screen
    expect(resolveSleeveFor('me', 'me', 'custom', 'data:image/jpeg;base64,xx').imageUrl).toBe(
      'data:image/jpeg;base64,xx',
    )
    expect(resolveSleeveFor('rival', 'me', 'midnight', null, '').id).toBe('classic')
    expect(resolveSleeveFor('rival', 'me', 'midnight', null, 'nebula').id).toBe('nebula')
  })
})
