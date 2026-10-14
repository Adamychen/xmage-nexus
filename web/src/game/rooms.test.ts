import { describe, expect, it } from 'vitest'

import { mergeRoomDoor, parseRoomDoor, roomDoorKey, roomSidesLabel } from './rooms'

describe('parseRoomDoor', () => {
  it('parses a left-door unlock', () => {
    expect(parseRoomDoor('Bob unlocked the left door of Dollhouse of Horrors.')).toEqual({
      player: 'Bob',
      side: 'left',
      card: 'Dollhouse of Horrors',
    })
  })

  it('parses a right-door unlock with the optional source suffix', () => {
    expect(parseRoomDoor('Bob unlocked the right door of Dollhouse of Horrors (source: Torch the Tower).')).toEqual({
      player: 'Bob',
      side: 'right',
      card: 'Dollhouse of Horrors',
    })
  })

  it('strips the wire font tags and id suffixes before matching', () => {
    expect(
      parseRoomDoor(
        "<font color='#FF0000'>Bob [a1]</font> unlocked the left door of <font color='#000000'>Dollhouse of Horrors [b22]</font> (source: <font color='#000000'>Torch the Tower [c3]</font>).",
      ),
    ).toEqual({ player: 'Bob', side: 'left', card: 'Dollhouse of Horrors' })
  })

  it('rejects unrelated broadcasts', () => {
    expect(parseRoomDoor('Bob has entered Oubliette (dungeon: Tomb of Annihilation)')).toBeNull()
    expect(parseRoomDoor("Bob's speed has increased to 2.")).toBeNull()
    expect(parseRoomDoor('Bob unlocked the door of Dollhouse of Horrors.')).toBeNull()
  })

  it('merges both sides and labels the badge', () => {
    expect(roomSidesLabel(undefined)).toBe('')
    expect(roomSidesLabel({ left: false, right: false })).toBe('')
    const afterLeft = mergeRoomDoor(undefined, 'left')
    expect(roomSidesLabel(afterLeft)).toBe('L')
    const both = mergeRoomDoor(afterLeft, 'right')
    expect(both).toEqual({ left: true, right: true })
    expect(roomSidesLabel(both)).toBe('L·R')
    expect(roomSidesLabel(mergeRoomDoor(both, 'left'))).toBe('L·R')
  })

  it('keys doors per game and normalized card name', () => {
    expect(roomDoorKey('g1', '  Dollhouse of Horrors ')).toBe('g1‖dollhouse of horrors')
    expect(roomDoorKey('g1', 'Dollhouse of Horrors')).not.toBe(roomDoorKey('g2', 'Dollhouse of Horrors'))
  })
})
