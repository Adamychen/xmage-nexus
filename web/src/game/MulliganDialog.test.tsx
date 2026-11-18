// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import MulliganDialog, { mulliganOptionHint } from './MulliganDialog'
import type { FeedbackPrompt } from './feedback'
import * as cmds from '../net/commands'
import { confirmDialog } from '../ui/confirmDialog'
import { reset } from '../state/store'
import { clearMulliganBottomPlan } from './mulliganBottomPlan'
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
  const sendNow = vi.fn(async (action: () => Promise<{ ok: boolean; error?: string }>) => {
    await action()
    return true
  })
  render(<MulliganDialog prompt={prompt} send={send} sendNow={sendNow} cancel={vi.fn()} busy={busy} />)
  return send
}

function renderLondon(prompt: FeedbackPrompt) {
  const sendNow = vi.fn(async (action: () => Promise<{ ok: boolean; error?: string }>) => {
    await action()
    return true
  })
  const view = render(
    <MulliganDialog prompt={prompt} send={vi.fn()} sendNow={sendNow} cancel={vi.fn()} busy={false} />,
  )
  const show = (next: FeedbackPrompt) =>
    view.rerender(
      <MulliganDialog prompt={next} send={vi.fn()} sendNow={sendNow} cancel={vi.fn()} busy={false} />,
    )
  return { sendNow, show }
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
    clearMulliganBottomPlan()
    setState({
      game: makeGameView({
        myPlayerId: 'p1',
        players: [],
        myHand: {
          'h-1': { id: 'h-1', name: 'Forest' } as any,
          'h-2': { id: 'h-2', name: 'Mountain' } as any,
          'h-3': { id: 'h-3', name: 'Island' } as any,
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
    const slots = document.querySelectorAll('.mulligan-fan .card-slot')
    expect(slots.length).toBe(2)
    for (const slot of slots) {
      expect(slot.getAttribute('role')).toBe('button')
      expect(slot.getAttribute('tabindex')).toBe('0')
    }
  })

  it('PRM-2: el título dice cuántas cartas faltan por poner al fondo', () => {
    renderDialog(londonPrompt())
    expect(screen.getByTestId('mulligan-title').textContent).toBe('Cartas por poner al fondo: 2')
    expect(screen.getByTestId('mulligan-count').textContent).toBe('Mulligans: 2')
  })

  it('PRM-2: Enter elige la carta, igual que el click, y no la envía', () => {
    const uuid = vi.spyOn(cmds, 'sendPlayerUUID').mockResolvedValue({ ok: true } as never)
    renderDialog(londonPrompt())
    const slot = document.querySelectorAll('.mulligan-fan .card-slot')[1] as HTMLElement

    fireEvent.keyDown(slot, { key: 'Enter' })

    expect(screen.getByTestId('mulligan-chosen-h-2')).toBeTruthy()
    expect(uuid).not.toHaveBeenCalled()
  })

  it('PRM-2: conservar la mano no se puede pulsar hasta elegir todas las cartas', () => {
    const uuid = vi.spyOn(cmds, 'sendPlayerUUID').mockResolvedValue({ ok: true } as never)
    renderDialog(londonPrompt())
    const keep = screen.getByTestId('mulligan-keep') as HTMLButtonElement
    const slots = document.querySelectorAll('.mulligan-fan .card-slot')

    expect(keep.disabled).toBe(true)
    expect(screen.getByTestId('mulligan-sub').textContent).toBe('0 de 2 elegidas')

    fireEvent.click(slots[0])
    expect(keep.disabled).toBe(true)
    expect(screen.getByTestId('mulligan-sub').textContent).toBe('1 de 2 elegidas')

    fireEvent.click(slots[1])
    expect(keep.disabled).toBe(false)
    expect(screen.getByTestId('mulligan-sub').textContent).toBe('2 de 2 elegidas')

    // Nothing has left the hand yet: the choice is still the player's to change.
    fireEvent.click(slots[1])
    expect(keep.disabled).toBe(true)
    expect(uuid).not.toHaveBeenCalled()
  })

  it('PRM-2: una carta elegida de más no entra; hay que soltar una primero', () => {
    renderDialog(londonPrompt({
      options: [
        { id: 'h-1', label: 'Forest', value: 'h-1' },
        { id: 'h-2', label: 'Mountain', value: 'h-2' },
        { id: 'h-3', label: 'Island', value: 'h-3' },
      ],
      progress: { selected: 0, remaining: 2 },
    }))
    const slots = document.querySelectorAll('.mulligan-fan .card-slot')
    fireEvent.click(slots[0])
    fireEvent.click(slots[1])
    fireEvent.click(slots[2])
    expect(document.querySelectorAll('.mulligan-card-wrap.is-chosen').length).toBe(2)
    expect(screen.queryByTestId('mulligan-chosen-h-3')).toBeNull()
  })

  it('PRM-2: al conservar la mano se envía una carta por cada pregunta del servidor', async () => {
    const uuid = vi.spyOn(cmds, 'sendPlayerUUID').mockResolvedValue({ ok: true } as never)
    const { show } = renderLondon(londonPrompt())
    const slots = document.querySelectorAll('.mulligan-fan .card-slot')
    fireEvent.click(slots[0])
    fireEvent.click(slots[1])

    fireEvent.click(screen.getByTestId('mulligan-keep'))
    await waitFor(() => expect(uuid).toHaveBeenCalledWith('h-1', 'game-1'))
    expect(uuid).toHaveBeenCalledTimes(1)

    // El servidor vuelve a preguntar por la que falta.
    setState({
      game: makeGameView({
        myPlayerId: 'p1',
        myHand: { 'h-2': { id: 'h-2', name: 'Mountain' } as any },
      }),
    })
    show(londonPrompt({
      message: 'Select a card (1 more) to put on the bottom of your library',
      options: [{ id: 'h-2', label: 'Mountain', value: 'h-2' }],
      progress: { selected: 1, remaining: 1 },
    }))

    await waitFor(() => expect(uuid).toHaveBeenCalledWith('h-2', 'game-1'))
    expect(uuid).toHaveBeenCalledTimes(2)
  })

  it('solo ofrece las cartas que el servidor admite como objetivo', () => {
    renderDialog(londonPrompt({ options: [{ id: 'h-1', label: 'Forest', value: 'h-1' }] }))
    const slots = document.querySelectorAll('.mulligan-fan .card-slot')
    expect(slots.length).toBe(1)
    expect(slots[0].getAttribute('data-card-id')).toBe('h-1')
  })

  it('no elige ni envía nada mientras hay un envío en curso', () => {
    const uuid = vi.spyOn(cmds, 'sendPlayerUUID').mockResolvedValue({ ok: true } as never)
    renderDialog(londonPrompt(), true)
    fireEvent.click(document.querySelectorAll('.mulligan-fan .card-slot')[0])
    expect(document.querySelector('.mulligan-card-wrap.is-chosen')).toBeNull()
    expect(uuid).not.toHaveBeenCalled()
  })
})

describe('MulliganDialog — pantalla de mano inicial', () => {
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

  it('PRM-2: la pantalla dice quién empieza, cuántas cartas hay y qué ofrece el mulligan', () => {
    renderDialog(mulliganPrompt({ message: 'Mulligan <font color=green>for free</font>, draw another 7 cards?' }))
    const screenEl = screen.getByTestId('mulligan-screen')
    expect(screen.getByTestId('mulligan-title').textContent).toContain('Empiezas tú')
    expect(screenEl.textContent).toContain('2 cartas')
    expect(screenEl.textContent).toContain('Roba 7, gratis')
    expect(screenEl.getAttribute('role')).toBe('dialog')
    expect(screen.queryByTestId('mulligan-count')).toBeNull()
  })

  it('PRM-2: nombra al rival cuando empieza él', () => {
    setState({ game: makeGameView({ myPlayerId: 'p1', activePlayerId: 'p2', players: [{ playerId: 'p2', name: 'Rival' }] as any }) })
    renderDialog(mulliganPrompt())
    expect(screen.getByTestId('mulligan-title').textContent).toContain('Empieza Rival')
  })

  it('PRM-2: ver el tablero deja la pantalla transparente y delante, y se vuelve a la mano', () => {
    renderDialog(mulliganPrompt())
    const backdrop = document.querySelector('.mulligan-backdrop') as HTMLElement
    expect(backdrop.classList.contains('is-peeking')).toBe(false)

    fireEvent.click(screen.getByTestId('mulligan-peek-open'))
    expect(backdrop.classList.contains('is-peeking')).toBe(true)
    // The screen itself never leaves: a peek reads the board, it does not play it.
    expect(screen.getByTestId('mulligan-screen').isConnected).toBe(true)

    fireEvent.click(screen.getByTestId('mulligan-peek-back'))
    expect(backdrop.classList.contains('is-peeking')).toBe(false)
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
