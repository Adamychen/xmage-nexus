// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import MulliganDialog from './MulliganDialog'
import type { FeedbackPrompt } from './feedback'
import * as cmds from '../net/commands'
import { confirmDialog } from '../ui/confirmDialog'
import { reset } from '../state/store'
import { setState } from '../state/state'
import { setLanguage } from '../i18n'
import { makeGameView } from '../__fixtures__/gameViews'

vi.mock('../ui/confirmDialog', () => ({
  confirmDialog: vi.fn().mockResolvedValue(true),
}))

vi.mock('../net/commands', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../net/commands')>()
  return { ...actual, sendPlayerAction: vi.fn().mockResolvedValue({ ok: true }) }
})

function mulliganPrompt(partial: Partial<FeedbackPrompt> = {}): FeedbackPrompt {
  return {
    method: 'GAME_ASK',
    gameId: 'game-1',
    title: 'Mulligan',
    message: 'Keep your hand or mulligan?',
    mode: 'boolean',
    options: [
      { id: 'keep', label: 'Keep hand', value: 'false' },
      { id: 'mulligan', label: 'Mulligan', value: 'true' },
    ],
    min: 0,
    max: 0,
    required: true,
    isMulligan: true,
    ...partial,
  }
}

function renderDialog(prompt: FeedbackPrompt, busy = false) {
  const send = vi.fn(async (action: () => Promise<{ ok: boolean; error?: string }>) => {
    await action()
  })
  render(<MulliganDialog prompt={prompt} send={send} cancel={vi.fn()} busy={busy} />)
  return send
}

describe('MulliganDialog — conceder', () => {
  beforeEach(() => {
    reset()
    setLanguage('es')
    vi.clearAllMocks()
    setState({ game: makeGameView({ myPlayerId: 'p1', players: [] }), gameId: 'game-1' })
  })

  afterEach(() => {
    cleanup()
  })

  it('muestra el botón Conceder en la decisión keep/mulligan', () => {
    renderDialog(mulliganPrompt())
    const btn = screen.getByTestId('mulligan-concede') as HTMLButtonElement
    expect(btn.textContent).toContain('Conceder')
    expect(btn.disabled).toBe(false)
  })

  it('al confirmar envía sendPlayerAction CONCEDE por el mismo camino que el menú', async () => {
    const send = renderDialog(mulliganPrompt())
    fireEvent.click(screen.getByTestId('mulligan-concede'))

    await waitFor(() => {
      expect(vi.mocked(confirmDialog)).toHaveBeenCalledWith(
        expect.stringContaining('conceder'),
        expect.objectContaining({ danger: true }),
      )
      expect(cmds.sendPlayerAction).toHaveBeenCalledWith('CONCEDE', 'game-1')
    })
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('no envía nada si el usuario cancela la confirmación', async () => {
    vi.mocked(confirmDialog).mockResolvedValueOnce(false)
    const send = renderDialog(mulliganPrompt())
    fireEvent.click(screen.getByTestId('mulligan-concede'))

    await waitFor(() => expect(vi.mocked(confirmDialog)).toHaveBeenCalled())
    expect(send).not.toHaveBeenCalled()
    expect(cmds.sendPlayerAction).not.toHaveBeenCalled()
  })

  it('el diálogo de London (poner cartas al fondo) también ofrece Conceder', () => {
    renderDialog(mulliganPrompt({ isMulligan: false, isMulliganLondon: true, min: 1, max: 2 }))
    expect(screen.getByTestId('mulligan-concede')).toBeTruthy()
  })

  it('deshabilita Conceder mientras hay una operación en curso', () => {
    renderDialog(mulliganPrompt(), true)
    expect((screen.getByTestId('mulligan-concede') as HTMLButtonElement).disabled).toBe(true)
  })
})

describe('MulliganDialog — grid de London-bottom por teclado', () => {
  beforeEach(() => {
    reset()
    setLanguage('es')
    vi.clearAllMocks()
    setState({
      game: makeGameView({
        myPlayerId: 'p1',
        players: [],
        myHand: {
          'h-1': { id: 'h-1', name: 'Forest' } as any,
          'h-2': { id: 'h-2', name: 'Mountain' } as any,
        },
      }),
      gameId: 'game-1',
    })
  })

  afterEach(() => {
    cleanup()
  })

  it('cada carta del grid es un elemento con role=button y tabIndex operable', () => {
    renderDialog(mulliganPrompt({ isMulligan: false, isMulliganLondon: true, min: 1, max: 2 }))
    const slots = document.querySelectorAll('.mulligan-hand-grid .card-slot')
    expect(slots.length).toBe(2)
    for (const slot of slots) {
      expect(slot.getAttribute('role')).toBe('button')
      expect(slot.getAttribute('tabindex')).toBe('0')
    }
  })

  it('Enter selecciona una carta para el fondo igual que el click, y refleja aria-pressed', () => {
    renderDialog(mulliganPrompt({ isMulligan: false, isMulliganLondon: true, min: 1, max: 2 }))
    const slot = document.querySelectorAll('.mulligan-hand-grid .card-slot')[0] as HTMLElement
    expect(slot.getAttribute('aria-pressed')).toBe('false')

    fireEvent.keyDown(slot, { key: 'Enter' })

    expect(slot.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByText('#1')).toBeTruthy()
  })

  it('Space también selecciona, y la selección habilita el botón de confirmar al llegar al mínimo', () => {
    renderDialog(mulliganPrompt({ isMulligan: false, isMulliganLondon: true, min: 1, max: 2 }))
    const slot = document.querySelectorAll('.mulligan-hand-grid .card-slot')[0] as HTMLElement
    const confirmBtn = document.querySelector('.mulligan-actions .primary') as HTMLButtonElement
    expect(confirmBtn.disabled).toBe(true)

    fireEvent.keyDown(slot, { key: ' ' })

    expect(confirmBtn.disabled).toBe(false)
  })
})
