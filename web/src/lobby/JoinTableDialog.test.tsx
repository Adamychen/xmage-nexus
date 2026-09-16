import { cleanup, fireEvent, render, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import JoinTableDialog, { recommendedMinMain } from './JoinTableDialog'
import { setState } from '../state/state'
import type { TableView } from '../net/types'

afterEach(() => {
  cleanup()
  setState({ conn: null } as never)
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
    expect(getByText('Constructed - Modern')).not.toBeNull()
    expect(getByText('Diana')).not.toBeNull()
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

describe('recommendedMinMain (C.13-mayores §4)', () => {
  it('Commander → 100, Limitado → 40, Construido → 60', () => {
    expect(recommendedMinMain('Variant Magic - Commander', 'Commander Free For All')).toBe(100)
    expect(recommendedMinMain('Constructed - Modern', 'Two Player Duel')).toBe(60)
    expect(recommendedMinMain('Limited', 'Booster Draft')).toBe(40)
  })

  it('sin dato de formato no recomienda (null)', () => {
    expect(recommendedMinMain('', '')).toBeNull()
    expect(recommendedMinMain('Variant Magic - Momir Basic', 'Momir Basic')).toBeNull()
    expect(recommendedMinMain(undefined, undefined)).toBeNull()
  })
})

describe('JoinTableDialog UX (C.13-mayores §4)', () => {
  it('el checkbox dice "Recordar como predeterminado", no "Guardar"', () => {
    const onJoin = vi.fn().mockResolvedValue(undefined)
    const { getByText, queryByLabelText } = render(
      <JoinTableDialog table={MOCK_TABLE} onClose={() => {}} onJoin={onJoin} />
    )
    expect(getByText('Recordar como predeterminado')).not.toBeNull()
    expect(queryByLabelText('Guardar')).toBeNull()
  })

  it('marca recomendado el mazo de 60 en mesa Modern', () => {
    const onJoin = vi.fn().mockResolvedValue(undefined)
    const { container } = render(
      <JoinTableDialog table={MOCK_TABLE} onClose={() => {}} onJoin={onJoin} />
    )
    expect(container.querySelectorAll('.join-deck-card.recommended').length).toBeGreaterThan(0)
  })

  it('sin formato conocido no marca ninguna recomendación', () => {
    const onJoin = vi.fn().mockResolvedValue(undefined)
    const { container } = render(
      <JoinTableDialog
        table={{ ...MOCK_TABLE, deckType: '', gameType: '' }}
        onClose={() => {}}
        onJoin={onJoin}
      />
    )
    expect(container.querySelectorAll('.join-deck-card.recommended').length).toBe(0)
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

  it('deshabilita la contraseña en beta.xmage.today (U4-2)', () => {
    setState({ conn: { serverHost: 'beta.xmage.today' } } as never)
    const onJoin = vi.fn().mockResolvedValue(undefined)

    const { getByPlaceholderText, getByRole, getByText } = render(
      <JoinTableDialog table={MOCK_PASSWORD_TABLE} onClose={() => {}} onJoin={onJoin} />
    )
    const passwordInput = getByPlaceholderText('Introduce la contraseña para entrar…') as HTMLInputElement
    expect(passwordInput.disabled).toBe(true)
    expect(getByText('En el servidor público (beta) no se puede entrar a mesas con contraseña.')).not.toBeNull()
    expect(getByRole('button', { name: /Unirse con/i }).hasAttribute('disabled')).toBe(true)
  })

  it('permite la contraseña fuera de beta (U4-2)', () => {
    setState({ conn: { serverHost: 'localhost' } } as never)
    const onJoin = vi.fn().mockResolvedValue(undefined)

    const { getByPlaceholderText, queryByText } = render(
      <JoinTableDialog table={MOCK_PASSWORD_TABLE} onClose={() => {}} onJoin={onJoin} />
    )
    const passwordInput = getByPlaceholderText('Introduce la contraseña para entrar…') as HTMLInputElement
    expect(passwordInput.disabled).toBe(false)
    expect(queryByText('En el servidor público (beta) no se puede entrar a mesas con contraseña.')).toBeNull()
  })
})
