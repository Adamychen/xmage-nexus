import { describe, expect, it } from 'vitest'
import {
  DUNGEON_GRAPHS,
  advanceProgress,
  dungeonRoot,
  findDungeonGraph,
  nextRooms,
  parseDungeonEntry,
  pathToRoom,
  roomLabel,
  ventureChoiceFromPrompt,
} from './dungeons'

describe('dungeon graphs (transcribed from mage.game.command.dungeons.*)', () => {
  it('identifies the four canonical dungeons by command-zone name', () => {
    expect(findDungeonGraph('Undercity')?.id).toBe('undercity')
    expect(findDungeonGraph('Dungeon of the Mad Mage')?.id).toBe('mad-mage')
    expect(findDungeonGraph('Lost Mine of Phandelver')?.id).toBe('phandelver')
    expect(findDungeonGraph('Tomb of Annihilation')?.id).toBe('tomb')
    expect(findDungeonGraph('The Ring')).toBeNull()
  })

  it('has a single root, binary forks and no cycles', () => {
    for (const graph of DUNGEON_GRAPHS) {
      expect(graph.depths[0]).toHaveLength(1)
      const names = graph.depths.flat().map((r) => r.name)
      expect(new Set(names).size).toBe(names.length)
      for (const name of names) {
        expect(nextRooms(graph, name).length).toBeLessThanOrEqual(2)
        const path = pathToRoom(graph, name)
        expect(path).not.toBeNull()
        expect(path?.[0]).toBe(dungeonRoot(graph))
        expect(new Set(path).size).toBe(path?.length)
      }
    }
  })

  it('models the Tomb diamond (Trapped Entry forks, both paths reach the Cradle)', () => {
    const tomb = findDungeonGraph('Tomb of Annihilation')
    expect(tomb).not.toBeNull()
    expect(nextRooms(tomb!, 'Trapped Entry').sort()).toEqual(['Oubliette', 'Veils of Fear'])
    expect(nextRooms(tomb!, 'Veils of Fear')).toEqual(['Sandfall Cell'])
    expect(nextRooms(tomb!, 'Oubliette')).toEqual(['Cradle of the Death God'])
    expect(nextRooms(tomb!, 'Sandfall Cell')).toEqual(['Cradle of the Death God'])
    expect(pathToRoom(tomb!, 'Cradle of the Death God')).toEqual([
      'Trapped Entry',
      'Oubliette',
      'Cradle of the Death God',
    ])
  })

  it('models the Undercity cross-links (Lost Well reaches Arena and Stash)', () => {
    const undercity = findDungeonGraph('Undercity')
    expect(nextRooms(undercity!, 'Lost Well').sort()).toEqual(['Arena', 'Stash'])
    expect(nextRooms(undercity!, 'Arena').sort()).toEqual(['Archives', 'Catacombs'])
    expect(nextRooms(undercity!, 'Catacombs')).toEqual(['Throne of the Dead Three'])
  })

  it('includes the rooms missing from the old linear list', () => {
    const names = (name: string) => findDungeonGraph(name)!.depths.flat().map((r) => r.name)
    expect(names('Dungeon of the Mad Mage')).toContain("Muiral's Graveyard")
    expect(names('Dungeon of the Mad Mage')).toContain('Deep Mines')
    expect(names('Lost Mine of Phandelver')).toContain('Fungi Cavern')
    expect(names('Undercity')).toContain('Catacombs')
    expect(names('Undercity')).toContain('Throne of the Dead Three')
  })
})

describe('roomLabel', () => {
  it('splits shared level labels by room order and survives short labels', () => {
    expect(roomLabel('Forge (x) / Lost Well (y)', { name: 'Forge', labelKey: 'k', part: 0 })).toBe('Forge (x)')
    expect(roomLabel('Forge (x) / Lost Well (y)', { name: 'Lost Well', labelKey: 'k', part: 1 })).toBe('Lost Well (y)')
    expect(roomLabel('Solo', { name: 'Solo', labelKey: 'k', part: 2 })).toBe('Solo')
    expect(roomLabel('Solo', { name: 'Solo', labelKey: 'k' })).toBe('Solo')
  })
})

describe('ventureChoiceFromPrompt', () => {
  const msg = 'Choose which room to go to in\ndungeon: Tomb of Annihilation'
  it('maps the clicked branch to its dungeon room', () => {
    expect(ventureChoiceFromPrompt(msg, 'Oubliette')).toEqual({ dungeon: 'tomb', room: 'Oubliette' })
    expect(ventureChoiceFromPrompt(msg, 'Veils of Fear')).toEqual({ dungeon: 'tomb', room: 'Veils of Fear' })
  })
  it('ignores non-venture prompts and unknown rooms', () => {
    expect(ventureChoiceFromPrompt('Take a mulligan?', 'Yes')).toBeNull()
    expect(ventureChoiceFromPrompt(msg, 'Mordor')).toBeNull()
  })
  it('identifies the dungeon by room when the message lacks the dungeon name', () => {
    expect(ventureChoiceFromPrompt('Choose which room to go to in', 'Sandfall Cell')).toEqual({
      dungeon: 'tomb',
      room: 'Sandfall Cell',
    })
  })
})

describe('advanceProgress', () => {
  it('appends rooms and ignores repeats of the current room', () => {
    expect(advanceProgress(['Trapped Entry'], 'Oubliette')).toEqual(['Trapped Entry', 'Oubliette'])
    expect(advanceProgress(['Trapped Entry'], 'Trapped Entry')).toEqual(['Trapped Entry'])
  })
})

describe('parseDungeonEntry (server broadcast, all players)', () => {
  it('extracts player, room and dungeon from "has entered" messages', () => {
    expect(parseDungeonEntry('Bob has entered Oubliette (dungeon: Tomb of Annihilation)')).toEqual({
      player: 'Bob',
      dungeon: 'Tomb of Annihilation',
      room: 'Oubliette',
    })
    expect(parseDungeonEntry("Ana María has entered Muiral's Graveyard (dungeon: Dungeon of the Mad Mage)")).toEqual({
      player: 'Ana María',
      dungeon: 'Dungeon of the Mad Mage',
      room: "Muiral's Graveyard",
    })
  })
  it('ignores unrelated log lines', () => {
    expect(parseDungeonEntry('Bob draws a card.')).toBeNull()
    expect(parseDungeonEntry('Bob has entered the battlefield.')).toBeNull()
  })
})
