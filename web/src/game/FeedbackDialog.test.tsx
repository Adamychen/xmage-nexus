// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import FeedbackDialog from './FeedbackDialog'
import { clearFeedback, handleMessage, setSetting } from '../state/store'
import { getState } from '../state/state'
import { setGateway, getGateway } from '../net/commands'
import type { Gateway } from '../net/Gateway'

function fakeGateway() {
  const send = vi.fn(async (action: string, args?: unknown) => ({ ok: true, action, requestId: 1, args }))
  return { send } as unknown as Gateway
}

function openPrompt(partial: Record<string, unknown> = {}) {
  handleMessage({
    type: 'event',
    method: 'GAME_GET_AMOUNT',
    messageId: 1,
    objectId: 'game-1',
    data: { message: 'Announce the value for {X}', min: 0, max: 10, ...partial },
  } as never)
}

describe('FeedbackDialog (componente)', () => {
  beforeEach(() => {
    setGateway(fakeGateway())
  })

  afterEach(() => {
    clearFeedback()
    setGateway(null)
    cleanup()
  })

  it('no renderiza nada sin feedback', () => {
    render(<FeedbackDialog />)
    expect(document.querySelector('.feedback-dialog')).toBeNull()
  })

  it('renderiza el diálogo integer (X cost) con input y Enviar', () => {
    openPrompt()
    render(<FeedbackDialog />)
    expect(screen.getByRole('heading', { name: 'Elige cantidad' })).toBeTruthy()
    expect(screen.getByLabelText('Cantidad')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Enviar' })).toBeTruthy()
  })

  it('enviar la cantidad manda sendPlayerInteger por el gateway', async () => {
    openPrompt({ min: 0, max: 10 })
    render(<FeedbackDialog />)
    fireEvent.change(screen.getByLabelText('Cantidad'), { target: { value: '4' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))
    await waitFor(() => {
      const send = getGateway().send as ReturnType<typeof vi.fn>
      expect(send).toHaveBeenCalledWith('sendPlayerInteger', expect.objectContaining({ value: 4, gameId: 'game-1' }))
    })
  })

  it('el diálogo de maná muestra el hint y los botones de reserva/pago', () => {
    handleMessage({
      type: 'event',
      method: 'GAME_PLAY_MANA',
      messageId: 2,
      objectId: 'game-1',
      data: {
        message: 'Pay {R}',
        gameView: {
          priorityTime: 2,
          turn: 1,
          phase: 'PRECOMBAT_MAIN',
          step: 'PRECOMBAT_MAIN',
          activePlayerId: 'p1',
          activePlayerName: 'Alice',
          priorityPlayerName: 'Alice',
          players: [
            {
              playerId: 'p1',
              name: 'Alice',
              controlled: true,
              isHuman: true,
              life: 20,
              manaPool: { red: 1, green: 0, blue: 0, white: 0, black: 0, colorless: 0 },
            },
          ],
        },
      },
    } as never)
    render(<FeedbackDialog />)
    expect(screen.getByText(/Haz clic en tus fuentes de maná/)).toBeTruthy()
    expect(screen.getByTestId('mana-pay-R')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Acción especial' })).toBeTruthy()
  })

  it('renderiza LibraryOrderDialog al recibir GAME_CHOOSE_CARDS_ORDER', () => {
    handleMessage({
      type: 'event',
      method: 'GAME_CHOOSE_CARDS_ORDER',
      messageId: 3,
      objectId: 'game-1',
      data: {
        message: 'Order cards on top of library',
        options: {
          'c-1': 'Ponder',
          'c-2': 'Brainstorm',
        },
      },
    } as never)
    render(<FeedbackDialog />)
    expect(screen.getAllByText('Ordena las cartas').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Ponder').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Brainstorm').length).toBeGreaterThanOrEqual(1)
  })

  it('renderiza CardGrid HD para GAME_CHOOSE_CARDS (tutor) y envía sendPlayerUUID al elegir', async () => {
    handleMessage({
      type: 'event',
      method: 'GAME_CHOOSE_CARDS',
      messageId: 4,
      objectId: 'game-1',
      data: {
        message: 'Search your library for a card',
        min: 1,
        max: 1,
        cardsView1: {
          'c-1': { id: 'c-1', name: 'Demonic Tutor', expansionSetCode: 'LEG', cardNumber: '74' },
          'c-2': { id: 'c-2', name: 'Swamp', expansionSetCode: 'LEA', cardNumber: '293' },
        },
      },
    } as never)
    render(<FeedbackDialog />)
    const dialog = document.querySelector('.card-grid-dialog')
    expect(dialog).toBeTruthy()
    expect(screen.getAllByText('Demonic Tutor').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Swamp').length).toBeGreaterThanOrEqual(1)

    const cell = dialog?.querySelector('.card-grid-cell') as HTMLElement
    fireEvent.click(cell)
    await waitFor(() => {
      const send = getGateway().send as ReturnType<typeof vi.fn>
      expect(send).toHaveBeenCalledWith('sendPlayerUUID', expect.objectContaining({ value: 'c-1', gameId: 'game-1' }))
    })
  })

  it('muestra título de descarte para GAME_CHOOSE_CARDS con mensaje de discard (Thoughtseize)', () => {
    handleMessage({
      type: 'event',
      method: 'GAME_CHOOSE_CARDS',
      messageId: 5,
      objectId: 'game-1',
      data: {
        message: 'Choose a card for them to discard',
        min: 1,
        max: 1,
        cardsView1: {
          'c-1': { id: 'c-1', name: 'Lightning Bolt', expansionSetCode: 'LEA', cardNumber: '161' },
        },
      },
    } as never)
    render(<FeedbackDialog />)
    expect(screen.getAllByText('Elige una carta para que descarte').length).toBeGreaterThan(0)
    expect(document.querySelector('.card-grid-dialog')).toBeTruthy()
  })

  it('filtra opciones en modo string en tiempo real según el texto escrito', () => {
    handleMessage({
      type: 'event',
      method: 'GAME_CHOOSE_STRING',
      messageId: 6,
      objectId: 'game-1',
      data: {
        message: 'Choose creature type',
        options: ['Goblin', 'Elf', 'Dragon', 'Zombie'],
      },
    } as never)
    render(<FeedbackDialog />)
    expect(screen.getByText('Goblin')).toBeTruthy()
    expect(screen.getByText('Elf')).toBeTruthy()
    expect(screen.getByText('Dragon')).toBeTruthy()
    expect(screen.getByText('Zombie')).toBeTruthy()

    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'gob' } })

    expect(screen.getByText('Goblin')).toBeTruthy()
    expect(screen.queryByText('Elf')).toBeNull()
    expect(screen.queryByText('Dragon')).toBeNull()
    expect(screen.queryByText('Zombie')).toBeNull()
  })

  it('muestra el subtítulo sourceName cuando está disponible', () => {
    handleMessage({
      type: 'event',
      method: 'GAME_ASK',
      messageId: 7,
      objectId: 'game-1',
      data: {
        message: 'Pay 2 life?',
        options: {
          'UI.left.btn.text': 'Yes',
          'UI.right.btn.text': 'No',
          secondMessage: 'Steam Vents',
        },
      },
    } as never)
    render(<FeedbackDialog />)
    expect(screen.getByText('Confirmación')).toBeTruthy()
    expect(screen.getByText('Steam Vents')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Sí/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /No/ })).toBeTruthy()
    expect(screen.queryByText('ASK')).toBeNull()
  })

  function openGridPrompt(count = 10, method = 'GAME_CHOOSE_MODE') {
    const choices: Record<string, string> = {}
    for (let i = 0; i < count; i++) choices[`k${i}`] = i === 3 ? 'Ancient Dragon' : `Option ${i}`
    handleMessage({
      type: 'event',
      method,
      messageId: 20,
      objectId: 'game-1',
      data: { message: 'Choose a mode', choices },
    } as never)
  }

  it('muestra búsqueda en el grid con más de 7 opciones y filtra al escribir', () => {
    openGridPrompt()
    render(<FeedbackDialog />)
    const search = screen.getByPlaceholderText('Filtrar opciones…')
    expect(search).toBeTruthy()
    expect(screen.getAllByRole('button', { name: /Option|Dragon/ })).toHaveLength(10)
    fireEvent.change(search, { target: { value: 'dragon' } })
    expect(screen.getAllByRole('button', { name: /Option|Dragon/ })).toHaveLength(1)
    expect(screen.getByRole('button', { name: /Ancient Dragon/ })).toBeTruthy()
  })

  it('Enter elige la opción filtrada en el grid', async () => {
    openGridPrompt()
    render(<FeedbackDialog />)
    fireEvent.change(screen.getByPlaceholderText('Filtrar opciones…'), { target: { value: 'dragon' } })
    fireEvent.keyDown(screen.getByPlaceholderText('Filtrar opciones…'), { key: 'Enter' })
    await waitFor(() => {
      const send = getGateway().send as ReturnType<typeof vi.fn>
      expect(send).toHaveBeenCalledWith('sendPlayerUUID', expect.objectContaining({ value: 'k3', gameId: 'game-1' }))
    })
  })

  it('doble-click elige en el grid de elección única', async () => {
    openGridPrompt()
    render(<FeedbackDialog />)
    fireEvent.doubleClick(screen.getByRole('button', { name: /Ancient Dragon/ }))
    await waitFor(() => {
      const send = getGateway().send as ReturnType<typeof vi.fn>
      expect(send).toHaveBeenCalledWith('sendPlayerUUID', expect.objectContaining({ value: 'k3' }))
    })
  })

  it('no muestra búsqueda con 4 o menos opciones', () => {
    openGridPrompt(4)
    render(<FeedbackDialog />)
    expect(screen.queryByPlaceholderText('Filtrar opciones…')).toBeNull()
  })

  function openChoicePrompt() {
    handleMessage({
      type: 'event',
      method: 'GAME_CHOOSE_CHOICE',
      messageId: 30,
      objectId: 'game-1',
      data: {
        choice: {
          message: 'Choose a tactic',
          keyChoices: { 't-a': 'Alpha strike', 't-b': 'Beta defense' },
          hintData: { 't-a': ['text', 'Fast and early'] },
          specialEnabled: true,
        },
      },
    } as never)
  }

  it('muestra hint y checkbox de recordar en Choice con metadatos del servidor', () => {
    openChoicePrompt()
    render(<FeedbackDialog />)
    expect(screen.getByRole('button', { name: /Alpha strike/ }).getAttribute('title')).toBe('Fast and early')
    expect(screen.getByRole('checkbox', { name: 'Recordar esta elección' })).toBeTruthy()
  })

  it('marcar recordar guarda la elección y la segunda aparición se auto-responde', async () => {
    openChoicePrompt()
    render(<FeedbackDialog />)
    fireEvent.click(screen.getByRole('checkbox', { name: 'Recordar esta elección' }))
    fireEvent.click(screen.getByRole('button', { name: /Beta defense/ }))
    await waitFor(() => {
      const send = getGateway().send as ReturnType<typeof vi.fn>
      expect(send).toHaveBeenCalledWith('sendPlayerString', expect.objectContaining({ value: 't-b', gameId: 'game-1' }))
    })
    expect(getState().settings.choiceMemory).toHaveLength(1)
    cleanup()
    clearFeedback()

    openChoicePrompt()
    render(<FeedbackDialog />)
    await waitFor(() => {
      const send = getGateway().send as ReturnType<typeof vi.fn>
      expect(send).toHaveBeenCalledWith('sendPlayerString', expect.objectContaining({ value: 't-b', gameId: 'game-1' }))
    })
    expect(document.querySelector('.feedback-dialog')).toBeNull()
    setSetting('choiceMemory', [])
  })

  it('Enter con una sola opción la envía directamente (preselección)', async () => {    handleMessage({
      type: 'event',
      method: 'GAME_CHOOSE_CHOICE',
      messageId: 31,
      objectId: 'game-1',
      data: { choice: { message: 'Only way', keyChoices: { 'only': 'The only path' } } },
    } as never)
    render(<FeedbackDialog />)
    fireEvent.keyDown(screen.getByLabelText(/Buscar/), { key: 'Enter' })
    await waitFor(() => {
      const send = getGateway().send as ReturnType<typeof vi.fn>
      expect(send).toHaveBeenCalledWith('sendPlayerString', expect.objectContaining({ value: 'only' }))
    })
  })

  it('GAME_CHOOSE_PILE con cartas pinta dos columnas y elegir envía booleano', async () => {
    const card = (id: string, name: string) => ({ id, name, displayName: name })
    handleMessage({
      type: 'event',
      method: 'GAME_CHOOSE_PILE',
      messageId: 40,
      objectId: 'game-1',
      data: {
        message: 'Separate into two piles',
        cardsView1: { 'c1': card('c1', 'Grizzly Bears') },
        cardsView2: { 'c2': card('c2', 'Lightning Bolt') },
      },
    } as never)
    render(<FeedbackDialog />)
    expect(screen.getByTestId('pile-column-1')).toBeTruthy()
    expect(screen.getByTestId('pile-column-2')).toBeTruthy()
    fireEvent.click(screen.getByTestId('pile-column-1'))
    await waitFor(() => {
      const send = getGateway().send as ReturnType<typeof vi.fn>
      expect(send).toHaveBeenCalledWith('sendPlayerBoolean', expect.objectContaining({ value: true, gameId: 'game-1' }))
    })
  })
})
