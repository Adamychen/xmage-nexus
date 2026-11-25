import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import ArenaBoard from './ArenaBoard'
import { makeGameView, makePlayer } from '../__fixtures__/gameViews'
import type { PlayerView } from '../net/types'
import { setState } from '../state/store'
import { outReasonKey, type OutReason } from './outReason'

function table(overrides: Record<string, Partial<PlayerView>> = {}) {
  const base = (id: string, name: string, controlled = false) =>
    makePlayer({ playerId: id, name, controlled, commandList: [], life: 40, ...overrides[id] })
  return makeGameView({
    activePlayerId: 'p1',
    players: [base('p1', 'Alice', true), base('p2', 'Bob'), base('p3', 'Carol'), base('p4', 'Dave')],
  })
}

const zoneOf = (root: ParentNode, id: string) => root.querySelector(`.opponent-zone[data-player-id="${id}"], .player-zone[data-player-id="${id}"]`)

describe('asientos de jugadores eliminados', () => {
  afterEach(() => cleanup())

  describe('arena', () => {
    it('sin eliminados no hay tiras', () => {
      const { container } = render(<ArenaBoard game={table()} />)
      expect(container.querySelector('[data-testid="defeated-seat"]')).toBeNull()
      expect(container.querySelectorAll('.arena-opp-cell .opponent-zone').length).toBe(3)
    })

    it('la columna de un rival derrotado se pliega y los demás siguen siendo zonas', () => {
      const { container } = render(<ArenaBoard game={table({ p3: { hasLeft: true, life: 0 } })} />)
      const cells = container.querySelectorAll('.arena-opp-cell')
      expect(cells.length).toBe(3)
      expect(cells[1].classList.contains('seat-cell--out')).toBe(true)
      expect(cells[1].querySelector('[data-testid="defeated-seat"]')?.getAttribute('data-player-id')).toBe('p3')
      expect(container.querySelectorAll('.arena-opp-cell .opponent-zone').length).toBe(2)
      expect(container.querySelector('.arena-board > .player-zone')).not.toBeNull()
    })

    it('reabrir la columna vuelve a mostrar su zona con el overlay de derrota oculto por CSS', () => {
      const { container } = render(<ArenaBoard game={table({ p2: { hasLeft: true } })} />)
      fireEvent.click(container.querySelector('[data-testid="defeated-seat"]') as HTMLElement)
      const cell = container.querySelector('.arena-opp-cell') as HTMLElement
      expect(cell.classList.contains('seat-cell--open')).toBe(true)
      expect(zoneOf(cell, 'p2')?.classList.contains('is-defeated')).toBe(true)
    })

    it('si cae un rival y el resto sigue vivo, cada uno conserva su columna', () => {
      const { container } = render(<ArenaBoard game={table({ p2: { hasLeft: true, life: 0 }, p4: { hasLeft: true, life: 0 } })} />)
      expect(container.querySelectorAll('.seat-cell--out').length).toBe(2)
      expect(zoneOf(container, 'p3')).not.toBeNull()
    })
  })
})

describe('el motivo de salida en los tableros sin panel', () => {
  afterEach(() => {
    cleanup()
    setState({ gameId: null, outReasons: {} })
  })

  const logged = (reason: OutReason) => setState({ gameId: 'g1', outReasons: { [outReasonKey('g1', 'Carol')]: reason } })

  it.each([
    ['concede', { life: 40, hasLeft: true }, 'conceded', 'conceded', 'ha concedido'],
    ['muere', { life: 0, hasLeft: true }, 'died', 'died', 'ha muerto'],
    ['pierde por un efecto', { life: 12, hasLeft: true }, 'died', 'died', 'ha muerto'],
    ['abandona la partida', { life: 23, hasLeft: true }, 'left', 'left', 'ha abandonado la partida'],
    ['se va sin línea de log y con 0 de vida', { life: 0, hasLeft: true }, null, 'died', 'ha muerto'],
    ['se va sin línea de log', { life: 23, hasLeft: true }, null, 'left', 'ha abandonado la partida'],
  ] as const)('BRD-65: la tira de quien %s dice por qué está fuera', (_caso, carol, reason, out, status) => {
    if (reason) logged(reason)
    const { container } = render(<ArenaBoard game={table({ p3: carol })} />)
    const seat = container.querySelector('[data-testid="defeated-seat"]') as HTMLElement
    expect(seat.getAttribute('data-out')).toBe(out)
    expect(seat.querySelector('.defeated-seat-status')?.textContent).toBe(status)
    expect(seat.getAttribute('aria-label')).toBe(`Carol ${status}`)
  })

  it('BRD-65: al reabrir el asiento, el overlay de la zona dice lo mismo', () => {
    logged('conceded')
    const { container } = render(<ArenaBoard game={table({ p3: { life: 40, hasLeft: true } })} />)
    fireEvent.click(container.querySelector('[data-testid="defeated-seat"]') as HTMLElement)
    const overlay = container.querySelector('.zone-defeated-overlay')
    expect(overlay?.querySelector('.zone-defeated-title')?.textContent).toBe('Carol ha concedido')
  })
})
