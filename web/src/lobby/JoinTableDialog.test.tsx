import { cleanup, fireEvent, render, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import JoinTableDialog from './JoinTableDialog'
import { getState, setState } from '../state/state'
import type { TableView } from '../net/types'

function memoryStorage(): Storage {
  const m = new Map<string, string>()
  return {
    get length() { return m.size },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => { m.set(k, String(v)) },
    removeItem: (k) => { m.delete(k) },
    key: (i) => [...m.keys()][i] ?? null,
  }
}

beforeEach(() => { vi.stubGlobal('localStorage', memoryStorage()) })
afterEach(() => {
  cleanup()
  setState({ conn: null, myDeck: null } as never)
  vi.unstubAllGlobals()
})


const MOCK_TABLE: TableView = {
  tableId: 'tab-123',
  tableName: "Diana's Modern Arena",
  controllerName: 'Diana',
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
    { playerName: 'Diana', seatIndex: 0, playerType: 'HUMAN' },
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

const MOCK_PASSWORD_TABLE: TableView = {
  ...MOCK_TABLE,
  tableName: 'Secret Commander Pod',
  deckType: 'Constructed - Commander',
  passworded: true,
}

describe('JoinTableDialog', () => {
  it('renders table meta and deck options', () => {
    const onJoin = vi.fn().mockResolvedValue(undefined)
    const onClose = vi.fn()

    const { getByText, getAllByText } = render(
      <JoinTableDialog table={MOCK_TABLE} onClose={onClose} onJoin={onJoin} />
    )

    expect(getByText("Diana's Modern Arena")).not.toBeNull()
    expect(getByText('Modern')).not.toBeNull()
    expect(getByText('Constructed - Modern · Two Player Duel')).not.toBeNull()
    expect(getByText('Diana')).not.toBeNull()
    expect(getByText('1/2 jugadores')).not.toBeNull()
    expect(getAllByText(/Mage Web bolt/).length).toBeGreaterThanOrEqual(1)
  })

  it('requires password when table is passworded and calls onJoin with password', async () => {
    const onJoin = vi.fn().mockResolvedValue(undefined)
    const onClose = vi.fn()

    const { getByPlaceholderText, getByRole, getByText } = render(
      <JoinTableDialog table={MOCK_PASSWORD_TABLE} onClose={onClose} onJoin={onJoin} />
    )

    expect(getByText('Requiere contraseña')).not.toBeNull()
    const passwordInput = getByPlaceholderText('Introduce la contraseña para entrar…')
    fireEvent.change(passwordInput, { target: { value: 'secret123' } })

    const submitBtn = getByRole('button', { name: /Unirse con/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(onJoin).toHaveBeenCalledWith(
        MOCK_PASSWORD_TABLE,
        expect.objectContaining({ name: expect.any(String) }),
        'secret123'
      )
    })
  })

  it('prefills the password from an invite deep link', async () => {
    const onJoin = vi.fn().mockResolvedValue(undefined)
    const onClose = vi.fn()

    const { getByPlaceholderText, getByRole } = render(
      <JoinTableDialog
        table={MOCK_PASSWORD_TABLE}
        initialPassword="invite-pwd"
        onClose={onClose}
        onJoin={onJoin}
      />
    )

    const passwordInput = getByPlaceholderText('Introduce la contraseña para entrar…') as HTMLInputElement
    expect(passwordInput.value).toBe('invite-pwd')

    const submitBtn = getByRole('button', { name: /Unirse con/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(onJoin).toHaveBeenCalledWith(
        MOCK_PASSWORD_TABLE,
        expect.objectContaining({ name: expect.any(String) }),
        'invite-pwd'
      )
    })
  })
  it('allows quick inline import of a new deck list', async () => {
    const onJoin = vi.fn().mockResolvedValue(undefined)
    const onClose = vi.fn()

    const { getByText, getByPlaceholderText, getByRole } = render(
      <JoinTableDialog table={MOCK_TABLE} onClose={onClose} onJoin={onJoin} />
    )

    const importToggle = getByText('Pegar mazo nuevo…')
    fireEvent.click(importToggle)

    const nameInput = getByPlaceholderText(/Mazo Importado|Imported Deck/)
    fireEvent.change(nameInput, { target: { value: 'My Red Burn' } })

    const textarea = getByPlaceholderText(/Pega aquí la lista de cartas/i)
    fireEvent.change(textarea, {
      target: { value: '4 Lightning Bolt (M10) 146\n20 Mountain (LEA) 292' },
    })

    const saveBtn = getByText('Guardar y Seleccionar')
    fireEvent.click(saveBtn)

    // Now Red Burn should be selected and reflected in submit button
    expect(getByText(/Unirse con "My Red Burn"/i)).not.toBeNull()

    const submitBtn = getByRole('button', { name: /Unirse con "My Red Burn"/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(onJoin).toHaveBeenCalledWith(
        MOCK_TABLE,
        expect.objectContaining({ name: 'My Red Burn' }),
        undefined
      )
    })
  })
})

describe('JoinTableDialog UX (C.13-mayores §4)', () => {
  it('no longer offers a "remember as default" toggle: the chosen deck is the one in play', async () => {
    const onJoin = vi.fn().mockResolvedValue(undefined)
    const { queryByText, queryByRole, getByRole } = render(
      <JoinTableDialog table={MOCK_TABLE} onClose={() => {}} onJoin={onJoin} />
    )
    expect(queryByText('Recordar como predeterminado')).toBeNull()
    expect(queryByRole('checkbox')).toBeNull()
    expect(getByRole('radiogroup', { name: 'Elige tu mazo' })).not.toBeNull()
    fireEvent.click(getByRole('button', { name: /Unirse con/i }))
    await waitFor(() => expect(onJoin).toHaveBeenCalled())
    const played = onJoin.mock.calls[0][1] as { name: string }
    expect(getState().myDeck?.name).toBe(played.name)
  })

  it('ranks decks that fit the table first and preselects one of them', () => {
    const onJoin = vi.fn().mockResolvedValue(undefined)
    const { container } = render(
      <JoinTableDialog table={MOCK_TABLE} onClose={() => {}} onJoin={onJoin} />
    )
    const tiles = [...container.querySelectorAll('.join-deck-card')]
    expect(tiles.length).toBeGreaterThan(0)
    expect(tiles[0].className).toMatch(/fit-(match|ok)/)
    const selected = container.querySelector('.join-deck-card.selected')
    expect(selected?.className).toMatch(/fit-(match|ok)/)
    expect(selected?.getAttribute('aria-checked')).toBe('true')
  })

  it('without a known format shows every deck as playable', () => {
    const onJoin = vi.fn().mockResolvedValue(undefined)
    const { container } = render(
      <JoinTableDialog
        table={{ ...MOCK_TABLE, deckType: '', gameType: '' }}
        onClose={() => {}}
        onJoin={onJoin}
      />
    )
    expect(container.querySelectorAll('.join-deck-card.fit-short').length).toBe(0)
    expect(container.querySelectorAll('.join-deck-group-label').length).toBe(0)
  })

  it('el fallo de unión se muestra dentro del diálogo, traducido y con cierre', async () => {
    const onJoin = vi.fn().mockRejectedValue(new Error('table full'))
    const { getByRole, getByTestId, queryByTestId } = render(
      <JoinTableDialog table={MOCK_TABLE} onClose={() => {}} onJoin={onJoin} />
    )
    fireEvent.click(getByRole('button', { name: /Unirse con/i }))

    const banner = await waitFor(() => getByTestId('join-error'))
    expect(banner.textContent).toContain('La mesa ya está completa')
    expect(banner.className).toContain('error-banner')

    fireEvent.click(within(banner).getByRole('button', { name: 'Cerrar' }))
    await waitFor(() => expect(queryByTestId('join-error')).toBeNull())
    expect(getByTestId('join-table-dialog')).not.toBeNull()
  })

  it('mantiene la contraseña operativa en beta.xmage.today (mesas privadas del servidor público)', async () => {
    setState({ conn: { serverHost: 'beta.xmage.today' } } as never)
    const onJoin = vi.fn().mockResolvedValue(undefined)

    const { getByPlaceholderText, getByRole, queryByText } = render(
      <JoinTableDialog table={MOCK_PASSWORD_TABLE} onClose={() => {}} onJoin={onJoin} />
    )
    const passwordInput = getByPlaceholderText('Introduce la contraseña para entrar…') as HTMLInputElement
    expect(passwordInput.disabled).toBe(false)
    expect(queryByText('En el servidor público (beta) no se puede entrar a mesas con contraseña.')).toBeNull()

    fireEvent.change(passwordInput, { target: { value: 'secret123' } })
    fireEvent.click(getByRole('button', { name: /Unirse con/i }))

    await waitFor(() => {
      expect(onJoin).toHaveBeenCalledWith(
        MOCK_PASSWORD_TABLE,
        expect.objectContaining({ name: expect.any(String) }),
        'secret123'
      )
    })
  })
})
