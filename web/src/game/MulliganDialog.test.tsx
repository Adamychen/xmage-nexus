// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import MulliganDialog, { mulliganOptionHint } from './MulliganDialog'
import type { FeedbackPrompt } from './feedback'
import * as cmds from '../net/commands'
import { confirmDialog } from '../ui/confirmDialog'
import { reset } from '../state/store'
import { setState } from '../state/state'
import { setLanguage, t } from '../i18n'
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
    renderDialog(mulliganPrompt({ method: 'GAME_TARGET', mode: 'uuid', isMulligan: false, isMulliganLondon: true }))
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

  const londonPrompt = (partial: Partial<FeedbackPrompt> = {}) => mulliganPrompt({
    method: 'GAME_TARGET',
    mode: 'uuid',
    message: 'Select a card (2 more) to put on the bottom of your library',
    options: [
      { id: 'h-1', label: 'Forest', value: 'h-1' },
      { id: 'h-2', label: 'Mountain', value: 'h-2' },
    ],
    isMulligan: false,
    isMulliganLondon: true,
    progress: { selected: 0, remaining: 2 },
    ...partial,
  })

  it('cada carta del grid es un elemento con role=button y tabIndex operable', () => {
    renderDialog(londonPrompt())
    const slots = document.querySelectorAll('.mulligan-hand-grid .card-slot')
    expect(slots.length).toBe(2)
    for (const slot of slots) {
      expect(slot.getAttribute('role')).toBe('button')
      expect(slot.getAttribute('tabindex')).toBe('0')
    }
  })

  it('muestra cuántas cartas faltan por poner al fondo', () => {
    renderDialog(londonPrompt())
    expect(screen.getByTestId('mulligan-london-remaining').textContent).toBe('Cartas por poner al fondo: 2')
  })

  it('Enter envía la carta al fondo en el acto, igual que el click', async () => {
    const uuid = vi.spyOn(cmds, 'sendPlayerUUID').mockResolvedValue({ ok: true } as never)
    const send = renderDialog(londonPrompt())
    const slot = document.querySelectorAll('.mulligan-hand-grid .card-slot')[1] as HTMLElement

    fireEvent.keyDown(slot, { key: 'Enter' })

    await waitFor(() => expect(uuid).toHaveBeenCalledWith('h-2', 'game-1'))
    expect(send).toHaveBeenCalledTimes(1)
    expect(document.querySelector('.mulligan-actions .ui-btn--primary')).toBeNull()
  })

  it('solo ofrece las cartas que el servidor admite como objetivo', () => {
    renderDialog(londonPrompt({ options: [{ id: 'h-1', label: 'Forest', value: 'h-1' }] }))
    const slots = document.querySelectorAll('.mulligan-hand-grid .card-slot')
    expect(slots.length).toBe(1)
    expect(slots[0].getAttribute('data-card-id')).toBe('h-1')
  })

  it('no envía nada mientras hay un envío en curso', () => {
    const uuid = vi.spyOn(cmds, 'sendPlayerUUID').mockResolvedValue({ ok: true } as never)
    renderDialog(londonPrompt(), true)
    fireEvent.click(document.querySelectorAll('.mulligan-hand-grid .card-slot')[0])
    expect(uuid).not.toHaveBeenCalled()
  })
})

describe('MulliganDialog — barra de mano inicial', () => {
  beforeEach(() => {
    reset()
    setLanguage('es')
    vi.clearAllMocks()
    setState({
      game: makeGameView({
        myPlayerId: 'p1',
        activePlayerId: 'p1',
        players: [{ playerId: 'p1', name: 'Yo' }, { playerId: 'p2', name: 'Rival' }] as any,
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

  it('pinta la barra con el número de cartas y quién empieza, sin modal', () => {
    renderDialog(mulliganPrompt({ message: 'Mulligan <font color=green>for free</font>, draw another 7 cards?' }))
    const bar = screen.getByTestId('mulligan-bar')
    expect(bar.textContent).toContain('Mano inicial')
    expect(bar.textContent).toContain('2 cartas')
    expect(screen.getByTestId('mulligan-starter').textContent).toContain('Empiezas tú')
    expect(bar.textContent).toContain('Roba 7, gratis')
    expect(document.querySelector('[role="dialog"]')).toBeNull()
  })

  it('nombra al rival cuando empieza él', () => {
    setState({ game: makeGameView({ myPlayerId: 'p1', activePlayerId: 'p2', players: [{ playerId: 'p2', name: 'Rival' }] as any }) })
    renderDialog(mulliganPrompt())
    expect(screen.getByTestId('mulligan-starter').textContent).toContain('Empieza Rival')
  })

  it('Conservar mano envía false y Mulligan envía true', async () => {
    const bool = vi.spyOn(cmds, 'sendPlayerBoolean').mockResolvedValue({ ok: true } as never)
    renderDialog(mulliganPrompt())
    fireEvent.click(screen.getByRole('button', { name: /Conservar mano/ }))
    await waitFor(() => expect(bool).toHaveBeenCalledWith(false, 'game-1'))
    fireEvent.click(screen.getByRole('button', { name: /^Mulligan/ }))
    await waitFor(() => expect(bool).toHaveBeenCalledWith(true, 'game-1'))
  })
})

describe('mulliganOptionHint', () => {
  beforeEach(() => setLanguage('es'))

  it('reads free and paid mulligans from the server ask', () => {
    expect(mulliganOptionHint('Mulligan <font color=#00ff00>for free</font>, draw another 7 cards?', t)).toBe('Roba 7, gratis')
    expect(mulliganOptionHint('Mulligan <font color=#ffff00>down to 6 cards</font>?', t)).toBe('Baja a 6 cartas')
    expect(mulliganOptionHint('Keep your hand or mulligan?', t)).toBeNull()
  })
})
