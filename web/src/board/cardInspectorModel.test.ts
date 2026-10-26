import { describe, expect, it } from 'vitest'
import type { CardView, GameView, PermanentView } from '../net/types'
import { cardTypeLine } from '../cards/rendered/cardLayout'
import {
  findPermanent,
  hasBattlefieldDetails,
  inspectorGlow,
  inspectorRarity,
  inspectorSetLabel,
  inspectorState,
  loyaltyRows,
} from './cardInspectorModel'

const perm = (fields: Record<string, unknown>) => ({ name: 'X', manaValue: 0, ...fields }) as unknown as PermanentView

const goyf = perm({
  id: 'goyf',
  name: 'Tarmogoyf',
  cardTypes: ['CREATURE'],
  power: '6',
  toughness: '7',
  originalPower: { baseValue: 0, cardValue: 0 },
  originalToughness: { baseValue: 1, cardValue: 1 },
  damage: 2,
  tapped: true,
  counters: [{ name: '+1/+1', count: 2 }],
  attachments: ['sword', 'gone'],
  nameController: 'me',
  nameOwner: 'them',
})
const sword = perm({ id: 'sword', name: 'Sword of Fire and Ice', cardTypes: ['ARTIFACT'], attachedTo: 'goyf' })
const jace = perm({
  id: 'jace',
  name: 'Jace, the Mind Sculptor',
  cardTypes: ['PLANESWALKER'],
  loyalty: '5',
  startingLoyalty: '3',
  counters: [{ name: 'loyalty', count: 5 }],
})
const game = { players: [{ battlefield: { goyf, sword } }, { battlefield: { jace } }] } as unknown as GameView

describe('card inspector battlefield state', () => {
  it('CRD-1: finds the live permanent in any player battlefield', () => {
    expect(findPermanent(game, 'jace')).toBe(jace)
    expect(findPermanent(game, 'nope')).toBeNull()
    expect(findPermanent(null, 'jace')).toBeNull()
  })

  it('CRD-1: shows changed power/toughness against the printed value, damage and counters', () => {
    const s = inspectorState(goyf, game)!
    expect([s.power, s.toughness, s.basePt]).toEqual(['6', '7', '0/1'])
    expect(s.trend).toEqual({ power: 'up', toughness: 'up' })
    expect([s.damage, s.toughnessLeft]).toEqual([2, 5])
    expect(s.counters).toEqual([{ name: '+1/+1', count: 2 }])
    expect(s.tapped).toBe(true)
    expect(s.summoningSick).toBe(false)
  })

  it('CRD-1: links attachments both ways and skips ones no longer on the battlefield', () => {
    expect(inspectorState(goyf, game)!.attachments).toEqual([{ id: 'sword', name: 'Sword of Fire and Ice' }])
    expect(inspectorState(sword, game)!.attachedTo).toEqual({ id: 'goyf', name: 'Tarmogoyf' })
  })

  it('CRD-1: names the owner only when it is not the controller', () => {
    expect(inspectorState(goyf, game)).toMatchObject({ controller: 'me', owner: 'them' })
    expect(inspectorState(perm({ nameController: 'me', nameOwner: 'me' }), game)).toMatchObject({ controller: 'me', owner: null })
  })

  it('CRD-1: leaves out what the printed card already says', () => {
    const plain = perm({ cardTypes: ['CREATURE'], power: '1', toughness: '1', originalPower: 1, originalToughness: 1 })
    const s = inspectorState(plain, game)!
    expect(s.power).toBeNull()
    expect(hasBattlefieldDetails(s)).toBe(false)
    const atStart = inspectorState(perm({ cardTypes: ['PLANESWALKER'], loyalty: '3', startingLoyalty: '3' }), game)!
    expect(atStart.shownLoyalty).toBeNull()
    expect(atStart.loyalty).toBe(3)
    expect(inspectorState(null, game)).toBeNull()
  })

  it('CRD-1: shows loyalty off its start once, not again as a counter', () => {
    const s = inspectorState(jace, game)!
    expect([s.shownLoyalty, s.startingLoyalty]).toEqual([5, 3])
    expect(s.counters).toEqual([])
    expect(hasBattlefieldDetails(s)).toBe(true)
  })

  it('CRD-1: marks a summoning-sick creature only while it is untapped', () => {
    expect(inspectorState(perm({ cardTypes: ['CREATURE'], summoningSickness: true }), game)!.summoningSick).toBe(true)
    expect(inspectorState(perm({ cardTypes: ['CREATURE'], summoningSickness: true, tapped: true }), game)!.summoningSick).toBe(false)
  })
})

describe('card inspector rules text', () => {
  const rules = ['+2: Look.', '0: Draw three cards.', '−1: Bounce.', '-12: Exile all.']

  it('CRD-4: splits loyalty abilities and dims the ones the loyalty cannot pay', () => {
    const rows = loyaltyRows(jace, rules, 5)!
    expect(rows.map((r) => [r.cost, r.sign, r.affordable])).toEqual([
      ['+2', 'plus', true],
      ['0', 'zero', true],
      ['−1', 'minus', true],
      ['−12', 'minus', false],
    ])
    expect(rows[0].text).toBe('Look.')
  })

  it('CRD-4: keeps every row payable when the loyalty is unknown', () => {
    expect(loyaltyRows(jace, rules, null)!.every((r) => r.affordable)).toBe(true)
  })

  it('CRD-4: leaves non-planeswalkers and plain text as paragraphs', () => {
    expect(loyaltyRows(goyf, rules, null)).toBeNull()
    expect(loyaltyRows(jace, ['Static text only.'], 5)).toBeNull()
  })
})

describe('card inspector header', () => {
  it('CRD-5: builds the type line from the types, never the raw enum', () => {
    const card = { name: 'J', cardTypes: ['PLANESWALKER'], superTypes: ['LEGENDARY'], subTypes: ['JACE'] } as unknown as CardView
    expect(cardTypeLine(card)).toBe('Legendary Planeswalker — Jace')
  })

  it('CRD-5: names the rarity and the printing', () => {
    expect(inspectorRarity(perm({ rarity: 'MYTHIC' }))).toBe('mythic')
    expect(inspectorRarity(perm({ rarity: 'LAND' }))).toBeNull()
    expect(inspectorSetLabel(perm({ expansionSetCode: 'mm3', cardNumber: '141' }))).toBe('MM3 #141')
    expect(inspectorSetLabel(perm({ expansionSetCode: 'MM3', cardNumber: '0' }))).toBe('MM3')
    expect(inspectorSetLabel(perm({}))).toBeNull()
  })

  it('CRD-5: colors the glow after the card', () => {
    expect(inspectorGlow(perm({ color: { green: true } }))).toBe('g')
    expect(inspectorGlow(perm({ color: { blue: true, red: true } }))).toBe('gold')
    expect(inspectorGlow(perm({ color: {} }))).toBe('none')
  })
})
