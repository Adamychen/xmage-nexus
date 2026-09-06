import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import SpectatorStagingScreen from './SpectatorStagingScreen'
import { setState } from '../state/store'
import type { TableView } from '../net/types'

const { swapSeatsMock, startMatchMock, startTournamentMock } = vi.hoisted(() => ({
  swapSeatsMock: vi.fn(async () => ({ ok: true })),
  startMatchMock: vi.fn(async () => ({ ok: true })),
  startTournamentMock: vi.fn(async () => ({ ok: true })),
}))

vi.mock('../net/commands', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../net/commands')>()),
  swapSeats: swapSeatsMock,
  startMatch: startMatchMock,
  startTournament: startTournamentMock,
}))

afterEach(() => {
  cleanup()
  swapSeatsMock.mockClear()
  startMatchMock.mockClear()
  startTournamentMock.mockClear()
  setState({ conn: null, stagingTableId: null, stagingIsTournament: false, lobby: null, phase: 'idle', chatMessages: [] })
})

vi.mock('./ChatBox', () => ({
  default: () => <div data-testid="chat-box-stub">Chat Stub</div>,
}))

const MOCK_DUEL_TABLE: TableView = {
  tableId: 'table-duel-1',
  tableName: "Alice's Showdown",
  controllerName: 'Alice',
  gameType: 'Two Player Duel',
  deckType: 'Constructed - Modern',
  additionalInfoShort: '',
  additionalInfoFull: '',
  createTime: Date.now(),
  tableState: 'WAITING',
  skillLevel: 'CASUAL',
  tableStateText: 'Waiting for players',
  seatsInfo: '1/2',
  isTournament: false,
  seats: [
    { playerName: 'Alice', seatIndex: 0, playerType: 'HUMAN' },
    { playerName: '', seatIndex: 1, playerType: 'HUMAN' },
  ],
  games: [],
  quitRatio: '0%',
  minimumRating: '0',
  limited: false,
  rated: true,
  passworded: false,
  spectatorsAllowed: true,
}

const MOCK_COMMANDER_TABLE: TableView = {
  tableId: 'table-comm-1',
  tableName: 'Epic Commander Pod',
  controllerName: 'Bob',
  gameType: 'Commander Free For All',
  deckType: 'Constructed - Commander',
  additionalInfoShort: '',
  additionalInfoFull: '',
  createTime: Date.now(),
  tableState: 'READY_TO_START',
  skillLevel: 'SERIOUS',
  tableStateText: 'Ready to start',
  seatsInfo: '4/4',
  isTournament: false,
  seats: [
    { playerName: 'Bob', seatIndex: 0, playerType: 'HUMAN' },
    { playerName: 'Charlie', seatIndex: 1, playerType: 'HUMAN' },
    { playerName: 'Diana', seatIndex: 2, playerType: 'HUMAN' },
    { playerName: 'Evan', seatIndex: 3, playerType: 'HUMAN' },
  ],
  games: [],
  quitRatio: '0%',
  minimumRating: '0',
  limited: false,
  rated: false,
  passworded: true,
  spectatorsAllowed: true,
}

describe('SpectatorStagingScreen', () => {
  it('renders 1v1 duel staging with player and VS indicator', () => {
    const { getByText } = render(<SpectatorStagingScreen table={MOCK_DUEL_TABLE} />)

    expect(getByText("Alice's Showdown")).not.toBeNull()
    expect(getByText('MODO ESPECTADOR')).not.toBeNull()
    expect(getByText('Alice')).not.toBeNull()
    expect(getByText('VS')).not.toBeNull()
    expect(getByText('Esperando oponente…')).not.toBeNull()
    expect(getByText('Esperando a que se completen las plazas de la mesa…')).not.toBeNull()
  })

  it('renders multiplayer Commander pod with all 4 players and ready banner', () => {
    const { getByText } = render(<SpectatorStagingScreen table={MOCK_COMMANDER_TABLE} />)

    expect(getByText('Epic Commander Pod')).not.toBeNull()
    expect(getByText('Bob')).not.toBeNull()
    expect(getByText('Charlie')).not.toBeNull()
    expect(getByText('Diana')).not.toBeNull()
    expect(getByText('Evan')).not.toBeNull()
    expect(getByText('Privada')).not.toBeNull()
    expect(getByText('Todos los jugadores están listos. Esperando a que el anfitrión inicie la partida…')).not.toBeNull()
  })

  it('triggers onLeave when clicking Leave button', () => {
    const onLeaveSpy = vi.fn()
    const { getByText } = render(<SpectatorStagingScreen table={MOCK_DUEL_TABLE} onLeave={onLeaveSpy} />)

    const leaveBtn = getByText('Volver al Lobby')
    fireEvent.click(leaveBtn)
    expect(onLeaveSpy).toHaveBeenCalled()
  })

  it('modo jugador: muestra acciones (salir/eliminar) y gatea Empezar por dueño+ready', () => {
    setState({
      conn: { username: 'Bob' } as never,
      stagingTableId: MOCK_COMMANDER_TABLE.tableId,
      lobby: { type: 'lobby', tables: [MOCK_COMMANDER_TABLE] } as never,
    })
    const { getByTestId, getByText } = render(<SpectatorStagingScreen mode="player" />)

    expect(getByTestId('staging-player-actions')).not.toBeNull()
    expect(getByTestId('staging-start')).not.toBeNull()
    expect(getByTestId('staging-remove')).not.toBeNull()
    expect(getByTestId('staging-leave')).not.toBeNull()
    expect(getByText(/MODO JUGADOR/)).not.toBeNull()
  })

  it('modo jugador: reconoce al dueño cuando controllerName concatena jugadores con comas (formato real del servidor XMage)', () => {
    const tableWithJoinedPlayers: TableView = {
      ...MOCK_COMMANDER_TABLE,
      controllerName: 'Bob, Charlie, Diana, Evan',
    }
    setState({
      conn: { username: 'Bob' } as never,
      stagingTableId: tableWithJoinedPlayers.tableId,
      lobby: { type: 'lobby', tables: [tableWithJoinedPlayers] } as never,
    })
    const { getByTestId, getAllByTitle } = render(<SpectatorStagingScreen mode="player" />)

    expect(getByTestId('staging-start')).not.toBeNull()
    expect(getByTestId('staging-remove')).not.toBeNull()
    expect(getAllByTitle(/anfitrión/i).length).toBeGreaterThan(0)
  })

  it('modo jugador: no owner no ve Empezar ni Eliminar', () => {
    setState({
      conn: { username: 'Charlie' } as never,
      stagingTableId: MOCK_COMMANDER_TABLE.tableId,
      lobby: { type: 'lobby', tables: [MOCK_COMMANDER_TABLE] } as never,
    })
    const { queryByTestId } = render(<SpectatorStagingScreen mode="player" />)

    expect(queryByTestId('staging-player-actions')).not.toBeNull()
    expect(queryByTestId('staging-start')).toBeNull()
    expect(queryByTestId('staging-remove')).toBeNull()
    expect(queryByTestId('staging-leave')).not.toBeNull()
  })

  it('permite alternar estado de preparación (Listo / No listo) y refleja Preparándose', () => {
    setState({
      conn: { username: 'Bob' } as never,
      stagingTableId: MOCK_COMMANDER_TABLE.tableId,
      lobby: { type: 'lobby', tables: [MOCK_COMMANDER_TABLE] } as never,
    })
    const { getByTestId, getByText } = render(<SpectatorStagingScreen mode="player" />)

    const toggleBtn = getByTestId('staging-toggle-ready')
    expect(toggleBtn.textContent).toContain('No estoy listo')

    fireEvent.click(toggleBtn)
    expect(toggleBtn.textContent).toContain('Estoy listo')
    expect(getByText(/Preparándose/i)).not.toBeNull()
  })

  it('Empezar sigue habilitado sin readys pero pide confirmación (aviso, no bloqueo)', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    try {
      setState({
        conn: { username: 'Bob' } as never,
        stagingTableId: MOCK_COMMANDER_TABLE.tableId,
        lobby: { type: 'lobby', tables: [MOCK_COMMANDER_TABLE] } as never,
        chatMessages: [
          { chatId: 'c1', username: 'Charlie', message: '[NEXUS_NOT_READY] Charlie' },
        ],
      })
      const { getByTestId } = render(<SpectatorStagingScreen mode="player" />)

      const startBtn = getByTestId('staging-start') as HTMLButtonElement
      expect(startBtn.disabled).toBe(false)
      fireEvent.click(startBtn)
      expect(confirmSpy).toHaveBeenCalled()
      expect(startMatchMock).toHaveBeenCalledWith(MOCK_COMMANDER_TABLE.tableId)
    } finally {
      confirmSpy.mockRestore()
    }
  })

  it('cancelar la confirmación no arranca la partida', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    try {
      setState({
        conn: { username: 'Bob' } as never,
        stagingTableId: MOCK_COMMANDER_TABLE.tableId,
        lobby: { type: 'lobby', tables: [MOCK_COMMANDER_TABLE] } as never,
        chatMessages: [
          { chatId: 'c1', username: 'Charlie', message: '[NEXUS_NOT_READY] Charlie' },
        ],
      })
      const { getByTestId } = render(<SpectatorStagingScreen mode="player" />)

      fireEvent.click(getByTestId('staging-start'))
      expect(confirmSpy).toHaveBeenCalled()
      expect(startMatchMock).not.toHaveBeenCalled()
    } finally {
      confirmSpy.mockRestore()
    }
  })

  it('mesa de torneo arranca con startTournament', () => {
    const tourneyTable: TableView = { ...MOCK_COMMANDER_TABLE, isTournament: true }
    setState({
      conn: { username: 'Bob' } as never,
      stagingTableId: tourneyTable.tableId,
      stagingIsTournament: true,
      lobby: { type: 'lobby', tables: [tourneyTable] } as never,
    })
    const { getByTestId } = render(<SpectatorStagingScreen mode="player" />)

    fireEvent.click(getByTestId('staging-start'))
    expect(startTournamentMock).toHaveBeenCalledWith(tourneyTable.tableId)
    expect(startMatchMock).not.toHaveBeenCalled()
  })

  it('abre el diálogo de cambiar baraja al pulsar Cambiar baraja', () => {
    setState({
      conn: { username: 'Bob' } as never,
      stagingTableId: MOCK_COMMANDER_TABLE.tableId,
      lobby: { type: 'lobby', tables: [MOCK_COMMANDER_TABLE] } as never,
    })
    const { getByTestId, getByText } = render(<SpectatorStagingScreen mode="player" />)

    const changeDeckBtn = getByTestId('staging-change-deck')
    fireEvent.click(changeDeckBtn)

    expect(getByText(/CAMBIAR BARAJA DE LA MESA/i)).not.toBeNull()
  })

  it('dueño en READY ve botones de orden por asiento con bordes deshabilitados', () => {
    setState({
      conn: { username: 'Bob' } as never,
      stagingTableId: MOCK_COMMANDER_TABLE.tableId,
      lobby: { type: 'lobby', tables: [MOCK_COMMANDER_TABLE] } as never,
    })
    const { getByTestId } = render(<SpectatorStagingScreen mode="player" />)

    expect((getByTestId('staging-seat-up-0') as HTMLButtonElement).disabled).toBe(true)
    expect((getByTestId('staging-seat-down-0') as HTMLButtonElement).disabled).toBe(false)
    expect((getByTestId('staging-seat-up-3') as HTMLButtonElement).disabled).toBe(false)
    expect((getByTestId('staging-seat-down-3') as HTMLButtonElement).disabled).toBe(true)
  })

  it('pulsar bajar en el asiento 0 llama a swapSeats con (0, 1)', () => {
    setState({
      conn: { username: 'Bob' } as never,
      stagingTableId: MOCK_COMMANDER_TABLE.tableId,
      lobby: { type: 'lobby', tables: [MOCK_COMMANDER_TABLE] } as never,
    })
    const { getByTestId } = render(<SpectatorStagingScreen mode="player" />)

    fireEvent.click(getByTestId('staging-seat-down-0'))
    expect(swapSeatsMock).toHaveBeenCalledWith(MOCK_COMMANDER_TABLE.tableId, 0, 1)
  })

  it('arrastrar el asiento 3 sobre el 0 llama a swapSeats con (3, 0)', () => {
    setState({
      conn: { username: 'Bob' } as never,
      stagingTableId: MOCK_COMMANDER_TABLE.tableId,
      lobby: { type: 'lobby', tables: [MOCK_COMMANDER_TABLE] } as never,
    })
    const { container } = render(<SpectatorStagingScreen mode="player" />)

    const store: Record<string, string> = {}
    const dataTransfer = {
      effectAllowed: '',
      dropEffect: '',
      setData: (k: string, v: string) => { store[k] = v },
      getData: (k: string) => store[k] ?? '',
    }
    const occupied = container.querySelectorAll('.ring-seat.occupied')
    expect(occupied.length).toBe(4)
    fireEvent.dragStart(occupied[3], { dataTransfer } as never)
    fireEvent.dragOver(occupied[0], { dataTransfer } as never)
    expect(occupied[0].className).toContain('seat-drop-target')
    fireEvent.drop(occupied[0], { dataTransfer } as never)
    expect(swapSeatsMock).toHaveBeenCalledWith(MOCK_COMMANDER_TABLE.tableId, 3, 0)
  })

  it('no dueño no ve botones de orden', () => {
    setState({
      conn: { username: 'Charlie' } as never,
      stagingTableId: MOCK_COMMANDER_TABLE.tableId,
      lobby: { type: 'lobby', tables: [MOCK_COMMANDER_TABLE] } as never,
    })
    const { queryByTestId } = render(<SpectatorStagingScreen mode="player" />)

    expect(queryByTestId('staging-seat-up-0')).toBeNull()
    expect(queryByTestId('staging-seat-down-0')).toBeNull()
  })

  it('dueño en WAITING ve botones de orden deshabilitados con aviso (no ocultos)', () => {
    setState({
      conn: { username: 'Alice' } as never,
      stagingTableId: MOCK_DUEL_TABLE.tableId,
      lobby: { type: 'lobby', tables: [MOCK_DUEL_TABLE] } as never,
    })
    const { getByTestId } = render(<SpectatorStagingScreen mode="player" />)

    const up = getByTestId('staging-seat-up-0') as HTMLButtonElement
    expect(up.disabled).toBe(true)
    expect(up.title).toMatch(/completa/i)
  })

  it('muestra rating, historial y bandera de cada asiento ocupado', () => {
    const richTable: TableView = {
      ...MOCK_COMMANDER_TABLE,
      seats: [
        { playerName: 'Bob', seatIndex: 0, playerType: 'HUMAN', flagName: 'es', constructedRating: 1720, history: '12-3' },
        ...MOCK_COMMANDER_TABLE.seats.slice(1),
      ],
    }
    setState({
      conn: { username: 'Zed' } as never,
      stagingTableId: richTable.tableId,
      lobby: { type: 'lobby', tables: [richTable] } as never,
    })
    const { container, getByText } = render(<SpectatorStagingScreen mode="player" />)

    expect(getByText('(1720)')).not.toBeNull()
    expect(getByText('12-3')).not.toBeNull()
    expect(container.querySelector('img[alt="ES"]')).not.toBeNull()
  })

  it('mesa limited muestra el rating limited', () => {
    const limitedTable: TableView = {
      ...MOCK_COMMANDER_TABLE,
      limited: true,
      seats: [
        { playerName: 'Bob', seatIndex: 0, playerType: 'HUMAN', constructedRating: 1600, limitedRating: 1480 },
        ...MOCK_COMMANDER_TABLE.seats.slice(1),
      ],
    }
    setState({
      conn: { username: 'Zed' } as never,
      stagingTableId: limitedTable.tableId,
      lobby: { type: 'lobby', tables: [limitedTable] } as never,
    })
    const { getByText, queryByText } = render(<SpectatorStagingScreen mode="player" />)

    expect(getByText('(1480)')).not.toBeNull()
    expect(queryByText('(1600)')).toBeNull()
  })
})
