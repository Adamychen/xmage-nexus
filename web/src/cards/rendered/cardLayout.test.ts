import { describe, expect, it } from 'vitest'
import type { CardView } from '../../net/types'
import { cardLayout, cardTypeLine, frameColors, frameFor, localizedLayout, parseRows } from './cardLayout'
import { fitScale, FIT_MIN } from './useTextFit'

function card(over: Partial<CardView>): CardView {
  return { name: 'Test', manaValue: 0, rules: [], cardTypes: [], subTypes: [], superTypes: [], ...over } as CardView
}

const RED = { white: false, blue: false, black: false, red: true, green: false }

describe('cardLayout', () => {
  it('classifies by card types, never by empty loyalty/defense strings', () => {
    const creature = card({ cardTypes: ['CREATURE'], loyalty: '', defense: '', power: '2', toughness: '2' })
    expect(cardLayout(creature).kind).toBe('standard')
    expect(cardLayout(creature).showStats).toBe(true)
    const walker = card({ cardTypes: ['PLANESWALKER'], loyalty: '3', power: '0', toughness: '0' })
    expect(cardLayout(walker).kind).toBe('planeswalker')
    expect(cardLayout(walker).showStats).toBe(false)
    expect(cardLayout(card({ cardTypes: ['BATTLE'], subTypes: ['SIEGE'] })).kind).toBe('battle')
  })

  it('detects sagas, classes, rooms, tokens, emblems, abilities and hidden cards', () => {
    expect(cardLayout(card({ cardTypes: ['ENCHANTMENT'], subTypes: ['SAGA'] })).kind).toBe('saga')
    expect(cardLayout(card({ cardTypes: ['ENCHANTMENT'], subTypes: ['CLASS'] })).kind).toBe('class')
    expect(cardLayout(card({ cardTypes: ['ENCHANTMENT'], subTypes: ['ROOM'] })).kind).toBe('room')
    expect(cardLayout(card({ cardTypes: ['CREATURE'], isToken: true })).kind).toBe('token')
    expect(cardLayout(card({ mageObjectType: 'EMBLEM' })).kind).toBe('emblem')
    expect(cardLayout(card({ rules: ['ICON_DUNGEON_ROOM_CURRENTCave'] })).kind).toBe('dungeon')
    expect(cardLayout(card({ hideInfo: true })).kind).toBe('hidden')
    expect(cardLayout(card({ faceDown: true, cardTypes: ['CREATURE'] })).kind).toBe('facedown')
  })

  it('reads adventure and split halves with their own costs', () => {
    const adventure = card({
      isSplitCard: true,
      leftSplitName: 'Giant',
      leftSplitCostsStr: '{2}{R}' as unknown as string[],
      leftSplitTypeLine: 'Creature - Giant ',
      leftSplitRules: ['body'],
      rightSplitName: 'Stomp',
      rightSplitCostsStr: '{1}{R}' as unknown as string[],
      rightSplitTypeLine: 'Instant - Adventure ',
      rightSplitRules: ['spell'],
    })
    const layout = cardLayout(adventure)
    expect(layout.kind).toBe('adventure')
    expect(layout.halves?.[0].cost).toEqual(['{2}', '{R}'])
    expect(layout.halves?.[1].name).toBe('Stomp')
    const split = cardLayout({ ...adventure, rightSplitTypeLine: 'Instant ' } as CardView)
    expect(split.kind).toBe('split')
  })

  it('splits planeswalker and saga rules into labelled rows', () => {
    const rows = parseRows(['+1: Draw a card.', '−2: Destroy it.', 'Static ability.'], /^\s*([+−–-]?\s?(?:\d+|X)):\s*([\s\S]*)$/)
    expect(rows.map((r) => r.label)).toEqual(['+1', '−2', null])
    const saga = cardLayout(card({ subTypes: ['SAGA'], cardTypes: ['ENCHANTMENT'], rules: ['I &mdash; Do a thing.', 'II, III &mdash; Do more.'] }))
    expect(saga.rows?.map((r) => r.label)).toEqual(['I', 'II,III'])
  })

  it('builds the type line and the frame colour from live data', () => {
    expect(cardTypeLine(card({ superTypes: ['LEGENDARY'], cardTypes: ['ARTIFACT', 'CREATURE'], subTypes: ['GOLEM'] }))).toBe('Legendary Artifact Creature — Golem')
    expect(frameColors(card({ color: RED }))).toEqual(['r'])
    expect(frameFor(card({ color: { ...RED, blue: true } }))).toBe('gold')
    expect(frameFor(card({ cardTypes: ['LAND'] }))).toBe('land')
    expect(frameFor(card({ cardTypes: ['ARTIFACT'] }))).toBe('colorless')
  })
})

describe('localizedLayout', () => {
  it('swaps in the localized name, type line and rules for ordinary layouts only', () => {
    const base = card({ name: 'Opt', cardTypes: ['INSTANT'], rules: ['Scry 1.'] })
    const out = localizedLayout(base, { name: 'Optar', typeLine: 'Instantáneo', rules: ['Adivina 1.'] })
    expect([out.name, out.typeLine, out.rules]).toEqual(['Optar', 'Instantáneo', ['Adivina 1.']])
    const walker = card({ cardTypes: ['PLANESWALKER'], rules: ['+1: Draw.'] })
    expect(localizedLayout(walker, { rules: ['+1: Roba.'] }).rows?.[0].text).toBe('Roba.')
    const emblem = card({ mageObjectType: 'EMBLEM', name: 'E' })
    expect(localizedLayout(emblem, { name: 'Otro' }).name).toBe('E')
    expect(localizedLayout(base, null)).toEqual(cardLayout(base))
  })
})

describe('leveler rows', () => {
  it('groups each LEVEL header with the lines under it', () => {
    const layout = cardLayout(card({ cardTypes: ['CREATURE'], rules: ['Level up {W}', 'LEVEL 2-6', '3/3', 'First strike', 'LEVEL 7+', '4/4', 'Double strike'] }))
    expect(layout.kind).toBe('leveler')
    expect(layout.rows).toEqual([
      { label: null, text: 'Level up {W}' },
      { label: 'Lv 2-6', text: '3/3 \u00b7 First strike' },
      { label: 'Lv 7+', text: '4/4 \u00b7 Double strike' },
    ])
  })
})

describe('fuse footer', () => {
  it('keeps the fuse line of a split card as a footer', () => {
    const layout = cardLayout(card({ isSplitCard: true, leftSplitName: 'A', rightSplitName: 'B', rules: ['Fuse <i>(x)</i>'] }))
    expect(layout.fusion).toBe(true)
    expect(layout.footer).toEqual(['Fuse <i>(x)</i>'])
  })
})

describe('dungeon rows', () => {
  it('turns the room markers into labels instead of leaking them as text', () => {
    const layout = cardLayout(card({ rules: ['<i>(Currently in X)</i>', 'ICON_DUNGEON_ROOM_CURRENTGoblin Lair', 'ICON_DUNGEON_ROOM_NEXTStoreroom', 'Cave'] }))
    expect(layout.rows?.map((r) => r.label)).toEqual([null, '\u25CF', '\u2192', null])
    expect(layout.rows?.[1].text).toBe('Goblin Lair')
  })
})

describe('fitScale', () => {
  it('leaves text that fits untouched and shrinks overflow down to a floor', () => {
    expect(fitScale(100, 120)).toBe(1)
    const s = fitScale(400, 100)
    expect(s).toBeLessThan(1)
    expect(s).toBeGreaterThanOrEqual(FIT_MIN)
    expect(fitScale(100000, 10)).toBe(FIT_MIN)
  })
})
