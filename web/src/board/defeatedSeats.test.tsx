import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import PodBoard from './PodBoard'
import ArenaBoard from './ArenaBoard'
import { makeGameView, makePlayer } from '../__fixtures__/gameViews'
import type { PlayerView } from '../net/types'

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

  describe('pod', () => {
    it('sin eliminados no hay tiras ni clases de plegado', () => {
      const { container } = render(<PodBoard game={table()} />)
      expect(container.querySelector('[data-testid="defeated-seat"]')).toBeNull()
      expect(container.querySelector('.seat-cell--out, .pod-row--out, .pod-board--br-out')).toBeNull()
    })

    it('un rival derrotado se pliega a una tira y su celda deja de ser una zona', () => {
      const { container } = render(<PodBoard game={table({ p2: { life: 0 } })} />)
      const seat = container.querySelector('[data-testid="defeated-seat"]') as HTMLElement
      expect(seat).not.toBeNull()
      expect(seat.getAttribute('data-player-id')).toBe('p2')
      expect(seat.closest('.pod-cell')?.classList.contains('seat-cell--out')).toBe(true)
      expect(zoneOf(container, 'p2')).toBeNull()
      expect(zoneOf(container, 'p3')).not.toBeNull()
      expect(zoneOf(container, 'p4')).not.toBeNull()
      expect(zoneOf(container, 'p1')).not.toBeNull()
    })

    it('la tira se reabre y se vuelve a plegar; abierta, el data-player-id lo lleva la zona', () => {
      const { container } = render(<PodBoard game={table({ p2: { life: 0 } })} />)
      fireEvent.click(container.querySelector('[data-testid="defeated-seat"]') as HTMLElement)

      const seat = container.querySelector('[data-testid="defeated-seat"]') as HTMLElement
      expect(seat.getAttribute('aria-expanded')).toBe('true')
      expect(seat.hasAttribute('data-player-id')).toBe(false)
      expect(seat.closest('.pod-cell')?.classList.contains('seat-cell--open')).toBe(true)
      expect(zoneOf(container, 'p2')?.classList.contains('is-defeated')).toBe(true)
      expect(container.querySelector('button[data-player-id="p2"]')).toBeNull()

      fireEvent.click(seat)
      expect(container.querySelector('[data-testid="defeated-seat"]')?.getAttribute('aria-expanded')).toBe('false')
      expect(zoneOf(container, 'p2')).toBeNull()
    })

    it('quien abandona se marca como is-left', () => {
      const { container } = render(<PodBoard game={table({ p3: { hasLeft: true } })} />)
      const seat = container.querySelector('[data-testid="defeated-seat"]')
      expect(seat?.classList.contains('is-left')).toBe(true)
      expect(seat?.getAttribute('data-player-id')).toBe('p3')
    })

    it('si los dos rivales de una fila caen, la fila entera se pliega', () => {
      const { container } = render(<PodBoard game={table({ p2: { life: 0 }, p3: { life: 0 } })} />)
      expect(container.querySelector('.pod-row--top')?.classList.contains('pod-row--out')).toBe(true)
      expect(container.querySelector('.pod-row--bottom')?.classList.contains('pod-row--out')).toBe(false)
      expect(container.querySelectorAll('.pod-row--top [data-testid="defeated-seat"]').length).toBe(2)
    })

    it('con el rival de abajo a la derecha derrotado la barra de mano cede su hueco', () => {
      const { container } = render(<PodBoard game={table({ p4: { life: 0 } })} />)
      expect(container.querySelector('.pod-board')?.classList.contains('pod-board--br-out')).toBe(true)
      expect(container.querySelector('.pod-row--bottom')?.classList.contains('pod-row--out')).toBe(false)
    })

    it('mi propio asiento nunca se pliega, aunque yo esté eliminado', () => {
      const { container } = render(<PodBoard game={table({ p1: { life: 0 } })} />)
      expect(container.querySelector('[data-testid="defeated-seat"]')).toBeNull()
      expect(zoneOf(container, 'p1')).not.toBeNull()
    })

    it('espectador: un rival eliminado también se pliega', () => {
      const game = table({ p3: { life: 0 } })
      game.players = (game.players ?? []).map((p) => ({ ...p, controlled: false }))
      const { container } = render(<PodBoard game={game} />)
      expect(container.querySelectorAll('[data-testid="defeated-seat"]').length).toBe(1)
      expect(container.querySelector('[data-testid="defeated-seat"]')?.getAttribute('data-player-id')).toBe('p3')
    })
  })

  describe('arena', () => {
    it('sin eliminados no hay tiras', () => {
      const { container } = render(<ArenaBoard game={table()} />)
      expect(container.querySelector('[data-testid="defeated-seat"]')).toBeNull()
      expect(container.querySelectorAll('.arena-opp-cell .opponent-zone').length).toBe(3)
    })

    it('la columna de un rival derrotado se pliega y los demás siguen siendo zonas', () => {
      const { container } = render(<ArenaBoard game={table({ p3: { life: 0 } })} />)
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
      const { container } = render(<ArenaBoard game={table({ p2: { life: 0 }, p4: { life: 0 } })} />)
      expect(container.querySelectorAll('.seat-cell--out').length).toBe(2)
      expect(zoneOf(container, 'p3')).not.toBeNull()
    })
  })
})
