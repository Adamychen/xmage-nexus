import { describe, expect, it } from 'vitest'
import { parseChosen, parseDungeonCompleted, parsePayChoice } from './playerLogFx'

const SOURCE_ID = '11111111-2222-3333-4444-555555555555'

describe('parsePayChoice', () => {
  it('reads a payment to prevent an effect', () => {
    expect(parsePayChoice("<font color='#20B2AA'>Alice</font> chooses to pay {2} to prevent the counter effect")).toEqual({ player: 'Alice', paid: true })
  })

  it('reads a declined payment', () => {
    expect(parsePayChoice("<font color='#20B2AA'>Alice</font> chooses not to pay {3} to prevent the counter effect")).toEqual({ player: 'Alice', paid: false })
  })

  it('reads the do-unless-pays form', () => {
    expect(parsePayChoice('Bob pays the cost to prevent the effect')).toEqual({ player: 'Bob', paid: true })
  })

  it('ignores other lines', () => {
    expect(parsePayChoice('Alice casts Opt')).toBeNull()
  })
})

describe('parseChosen', () => {
  it('reads a choice made on a source permanent and keeps its id', () => {
    expect(parseChosen(`<font color='#B0C4DE' object_id='${SOURCE_ID}'>Painter's Servant</font> [111]: <font color='#20B2AA'>Alice</font> has chosen Blue`))
      .toEqual({ player: 'Alice', choice: 'Blue', sourceId: SOURCE_ID })
  })

  it('reads a choice made on a plain-name source', () => {
    expect(parseChosen('Adaptive Automaton: Alice has chosen Elf')).toEqual({ player: 'Alice', choice: 'Elf', sourceId: null })
  })

  it('reads a colour choice', () => {
    expect(parseChosen('Alice has chosen the color: Red')).toEqual({ player: 'Alice', choice: 'Red', sourceId: null })
  })

  it('reads a card type choice', () => {
    expect(parseChosen('Cast Out: Alice has chosen: Creature')).toEqual({ player: 'Alice', choice: 'Creature', sourceId: null })
  })

  it('ignores the Ring-bearer and companion lines', () => {
    expect(parseChosen('Alice has chosen Frodo as Ring-bearer.')).toBeNull()
    expect(parseChosen('Alice has chosen Lurrus as their companion.')).toBeNull()
  })
})

describe('parseDungeonCompleted', () => {
  it('reads a completed dungeon', () => {
    expect(parseDungeonCompleted('Alice has completed Tomb of Annihilation')).toEqual({ player: 'Alice', dungeon: 'Tomb of Annihilation' })
  })

  it('ignores other lines', () => {
    expect(parseDungeonCompleted('Alice casts Opt')).toBeNull()
  })
})
