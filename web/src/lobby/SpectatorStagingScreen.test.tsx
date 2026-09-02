import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import SpectatorStagingScreen from './SpectatorStagingScreen'
import { setState } from '../state/store'
import type { TableView } from '../net/types'

afterEach(() => {
  cleanup()
  setState({ conn: null, stagingTableId: null, lobby: null, phase: 'idle' })
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
    expect(getByText('👁️ MODO ESPECTADOR')).not.toBeNull()
    expect(getByText('Alice')).not.toBeNull()
    expect(getByText('VS')).not.toBeNull()
    expect(getByText('Esperando oponente…')).not.toBeNull()
    expect(getByText('⏳ Esperando a que se completen las plazas de la mesa…')).not.toBeNull()
  })

  it('renders multiplayer Commander pod with all 4 players and ready banner', () => {
    const { getByText } = render(<SpectatorStagingScreen table={MOCK_COMMANDER_TABLE} />)

    expect(getByText('Epic Commander Pod')).not.toBeNull()
    expect(getByText('Bob')).not.toBeNull()
    expect(getByText('Charlie')).not.toBeNull()
    expect(getByText('Diana')).not.toBeNull()
    expect(getByText('Evan')).not.toBeNull()
    expect(getByText('🔒 Privada')).not.toBeNull()
    expect(getByText('✨ Todos los jugadores están listos. Esperando a que el anfitrión inicie la partida…')).not.toBeNull()
  })

  it('triggers onLeave when clicking Leave button', () => {
    const onLeaveSpy = vi.fn()
    const { getByText } = render(<SpectatorStagingScreen table={MOCK_DUEL_TABLE} onLeave={onLeaveSpy} />)

    const leaveBtn = getByText('🚪 Volver al Lobby')
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

  it('deshabilita el botón Empezar si algún jugador no está listo mediante mensaje chat', () => {
    setState({
      conn: { username: 'Bob' } as never,
      stagingTableId: MOCK_COMMANDER_TABLE.tableId,
      lobby: { type: 'lobby', tables: [MOCK_COMMANDER_TABLE] } as never,
      chatMessages: [
        { chatId: 'c1', username: 'Charlie', message: '[NEXUS_NOT_READY] Charlie' },
      ],
    })
    const { getByTestId, getByText } = render(<SpectatorStagingScreen mode="player" />)

    const startBtn = getByTestId('staging-start') as HTMLButtonElement
    expect(startBtn.disabled).toBe(true)
    expect(getByText(/Esperando a que todos los jugadores confirmen/i)).not.toBeNull()
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
})
