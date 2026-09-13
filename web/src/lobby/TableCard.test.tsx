import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import TableCard from './TableCard'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

function tableOf(over: Record<string, unknown> = {}) {
  return {
    tableId: 't-1',
    tableName: 'Mesa test',
    gameType: 'Two Player Duel',
    deckType: 'Freeform',
    controllerName: '',
    tableState: 'WAITING',
    tableStateText: 'En espera',
    seatsInfo: '0/2',
    seats: [],
    games: [],
    isTournament: false,
    rated: true,
    passworded: false,
    spectatorsAllowed: true,
    createTime: Date.now(),
    skillLevel: 0,
    ...over,
  } as never
}

const handlers = {
  onJoinHuman: () => {},
  onJoinAi: () => {},
  onStart: () => {},
  onWatch: () => {},
  onResume: () => {},
  onOpenBracket: () => {},
  onSelectUser: () => {},
}

describe('TableCard badges (C.13 nit: densos solo-icono)', () => {
  it('el badge rated solo-icono expone nombre accesible con el dato', () => {
    const { container } = render(
      <TableCard tTable={tableOf({ rated: true })} users={[]} stagingTableId={null} busyTable={null} {...handlers} />,
    )
    const badge = container.querySelector('.table-tag-rated') as HTMLElement
    expect(badge).not.toBeNull()
    expect(badge.getAttribute('role')).toBe('img')
    expect(badge.getAttribute('aria-label')).toBeTruthy()
  })

  it('el badge de espectadores expone etiqueta con el dato', () => {
    const { container } = render(
      <TableCard tTable={tableOf({ spectatorsAllowed: true })} users={[]} stagingTableId={null} busyTable={null} {...handlers} />,
    )
    const badge = container.querySelector('.table-tag-spectate') as HTMLElement
    expect(badge).not.toBeNull()
    expect(badge.getAttribute('aria-label')).toBeTruthy()
  })
})
