import { beforeEach, describe, expect, it, vi } from 'vitest'
import { diffStagingRoster, notifyStagingRoster, stagingRosterNames } from './stagingSounds'
import { soundManager } from '../audio/soundManager'
import type { SeatView, TableView } from '../net/types'

function seats(names: (string | null)[]): SeatView[] {
  return names.map((n, i) => ({ playerName: n ?? '', seatIndex: i, playerType: 'HUMAN' }))
}

function table(seats: SeatView[]): TableView {
  return { tableId: 't1', seats } as TableView
}

describe('stagingSounds (U4-12)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(soundManager, 'play').mockImplementation(() => {})
  })

  it('stagingRosterNames ignora asientos vacíos', () => {
    expect(stagingRosterNames(seats(['Alice', '', 'Bob']))).toEqual(['Alice', 'Bob'])
    expect(stagingRosterNames(null)).toEqual([])
  })

  it('diff detecta entradas y salidas', () => {
    expect(diffStagingRoster(seats(['Alice']), seats(['Alice', 'Bob']))).toEqual({ joined: ['Bob'], left: [] })
    expect(diffStagingRoster(seats(['Alice', 'Bob']), seats(['Alice']))).toEqual({ joined: [], left: ['Bob'] })
    expect(diffStagingRoster(seats(['Alice']), seats(['Alice']))).toEqual({ joined: [], left: [] })
  })

  it('diff excluye el propio usuario', () => {
    expect(diffStagingRoster(seats([]), seats(['Me']), 'Me')).toEqual({ joined: [], left: [] })
    expect(diffStagingRoster(seats(['Me']), seats([]), 'Me')).toEqual({ joined: [], left: [] })
  })

  it('notify suena join/leave y calla sin cambios', () => {
    notifyStagingRoster(table(seats(['Alice'])), table(seats(['Alice', 'Bob'])))
    expect(soundManager.play).toHaveBeenCalledWith('player_join', 'ui')
    notifyStagingRoster(table(seats(['Alice', 'Bob'])), table(seats(['Alice'])))
    expect(soundManager.play).toHaveBeenCalledWith('player_leave', 'ui')
  })

  it('notify calla sin cambios o sin mesa', () => {
    notifyStagingRoster(table(seats(['Alice'])), table(seats(['Alice'])))
    expect(soundManager.play).not.toHaveBeenCalled()
    notifyStagingRoster(undefined, table(seats(['Alice'])))
    expect(soundManager.play).not.toHaveBeenCalled()
  })
})
