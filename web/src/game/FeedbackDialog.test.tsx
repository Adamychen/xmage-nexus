// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import FeedbackDialog from './FeedbackDialog'
import { clearFeedback, handleMessage } from '../state/store'
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
    expect(screen.getByRole('button', { name: /Pagar reserva: R1/ })).toBeTruthy()
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
    expect(screen.getByText('Ordena las cartas')).toBeTruthy()
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
    expect(screen.getByText('Elige una carta para que descarte')).toBeTruthy()
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
    expect(screen.getByRole('button', { name: /Yes/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /No/ })).toBeTruthy()
    expect(screen.queryByText('ASK')).toBeNull()
  })
})
