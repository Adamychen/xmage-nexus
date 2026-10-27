import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import TableCard from './TableCard'
import { setLanguage } from '../i18n'

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

const render1 = (over: Record<string, unknown> = {}) =>
  render(<TableCard tTable={tableOf(over)} users={[]} stagingTableId={null} busyTable={null} {...handlers} />)

describe('TableCard contents', () => {
  it('LBY-21: the card carries the colour family of its format', () => {
    const { container } = render1({ deckType: 'Variant Magic - Commander', gameType: 'Commander Free For All' })
    const card = container.querySelector('.table-card') as HTMLElement
    expect(card.classList.contains('fmt-commander')).toBe(true)
    expect(card.querySelector('.tc-format-name')?.textContent).toBe('Commander')
  })

  it('LBY-23: shows the game mode, the best-of and the options the server packs in the table info', () => {
    setLanguage('en')
    const { container } = render1({
      gameType: 'Commander Free For All',
      deckType: 'Variant Magic - Commander',
      seats: [{ playerName: 'Alice', seatIndex: 0, playerType: 'HUMAN' }, { playerName: '', seatIndex: 1, playerType: 'HUMAN' }, { playerName: '', seatIndex: 2, playerType: 'HUMAN' }],
      additionalInfoShort: 'Wins: 2, Time: 20m(+10s), Custom options (1), SP, Rng: ONE',
      additionalInfoFull: 'Wins required: 2 (Best of 3)<br>Starting Life: 30',
      rated: false,
      skillLevel: 'CASUAL',
    })
    expect(container.querySelector('.tc-mode-name')?.textContent).toBe('Commander Free For All')
    expect(container.querySelector('.tc-mode-bo')?.textContent).toContain('Best of 3')
    const facts = Array.from(container.querySelectorAll('.table-fact')).map((f) => f.textContent)
    expect(facts).toEqual(['Clock 20m (+10s)', 'Casual', 'Unrated', 'Range 1', 'Custom rules (1)'])
    expect(container.querySelector('.table-facts')?.getAttribute('title')).toBe('Wins required: 2 (Best of 3)\nStarting Life: 30')
    expect(container.querySelector('.table-state-badge')?.textContent).toBe('2 free')
    setLanguage('es')
  })

  it('LBY-23: shows the score of a match in progress with the players in the server order', () => {
    const { container } = render1({
      tableState: 'DUELING',
      controllerName: 'Gus, Heidi',
      additionalInfoShort: 'Wins: 2 Score: 1-0, SP',
    })
    expect(container.querySelector('.table-fact')?.textContent).toBe('Gus 1 – 0 Heidi')
  })

  it('LBY-23: an occupied seat shows its player and rank emblem, keeps the numbers in its tooltip, and an AI seat names its AI', () => {
    const { container } = render1({
      controllerName: 'Alice',
      seats: [
        { playerName: 'Alice', seatIndex: 0, playerType: 'HUMAN', flagName: 'es', constructedRating: 1617, history: 'Matches: 8390 (Q:12) (12%)' },
        { playerName: '', seatIndex: 1, playerType: 'COMPUTER_MAD' },
      ],
    })
    expect(container.querySelector('.seat-ready-indicator')).toBeNull()
    expect(container.querySelector('.seat-crown')).not.toBeNull()
    const seat = container.querySelector('.seat-badge.occupied') as HTMLElement
    expect(seat.querySelector('.seat-rank')).not.toBeNull()
    expect(seat.textContent).not.toContain('1617')
    expect(seat.getAttribute('title')).toContain('ELO 1617')
    expect(container.querySelector('.seat-badge.empty.is-ai')?.textContent).toContain('Mad')
  })

  it('LBY-23: a table closed to spectators says so and cannot be watched from the lobby', () => {
    const closed = render1({ spectatorsAllowed: false })
    expect(closed.container.querySelector('.table-tag-no-spectators')).not.toBeNull()
    expect((closed.container.querySelector('[data-testid="watch-btn"]') as HTMLButtonElement).disabled).toBe(true)
    closed.unmount()
    const open = render1({ spectatorsAllowed: true })
    expect(open.container.querySelector('.table-tag-no-spectators')).toBeNull()
    expect((open.container.querySelector('[data-testid="watch-btn"]') as HTMLButtonElement).disabled).toBe(false)
  })

  it('a rated table carries a labelled badge and an unrated one says so in its facts', () => {
    setLanguage('en')
    expect(render1({ rated: true }).container.querySelector('.table-tag-rated')?.textContent).toBe('Rated')
    cleanup()
    const unrated = render1({ rated: false })
    expect(unrated.container.querySelector('.table-tag-rated')).toBeNull()
    expect(unrated.container.querySelector('.table-facts')?.textContent).toContain('Unrated')
    setLanguage('es')
  })
})

describe('TableCard estado de mesa (i18n)', () => {
  it('traduce WAITING/DUELING/FINISHED en es y en', () => {
    const cases = [
      ['WAITING', 'En espera', 'Waiting'],
      ['DUELING', 'En partida', 'Dueling'],
      ['FINISHED', 'Finalizada', 'Finished'],
    ] as const
    for (const [tableState, esText, enText] of cases) {
      setLanguage('es')
      const esView = render(
        <TableCard tTable={tableOf({ tableState, tableStateText: 'Waiting for players' })} users={[]} stagingTableId={null} busyTable={null} {...handlers} />,
      )
      expect(esView.container.querySelector('.table-state-badge')?.textContent, `${tableState} es`).toBe(esText)
      esView.unmount()
      setLanguage('en')
      const enView = render(
        <TableCard tTable={tableOf({ tableState, tableStateText: 'Waiting for players' })} users={[]} stagingTableId={null} busyTable={null} {...handlers} />,
      )
      expect(enView.container.querySelector('.table-state-badge')?.textContent, `${tableState} en`).toBe(enText)
      enView.unmount()
    }
    setLanguage('es')
  })

  it('usa tableStateText como fallback para estados desconocidos', () => {
    const { container } = render(
      <TableCard tTable={tableOf({ tableState: 'MYSTERY', tableStateText: 'Custom state' })} users={[]} stagingTableId={null} busyTable={null} {...handlers} />,
    )
    expect(container.querySelector('.table-state-badge')?.textContent).toBe('Custom state')
  })
})
