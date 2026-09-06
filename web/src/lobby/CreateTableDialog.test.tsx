import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import CreateTableDialog from './CreateTableDialog'
import * as cmds from '../net/commands'

vi.mock('../net/commands', () => ({
  getGameTypes: vi.fn().mockResolvedValue([
    { name: 'Two Player Duel', minPlayers: 2, maxPlayers: 2 },
    { name: 'Commander Free For All', minPlayers: 3, maxPlayers: 10 },
  ]),
  getDeckTypes: vi.fn().mockResolvedValue(['Constructed - Modern', 'Constructed - Standard', 'Variant Magic - Commander', 'Limited']),
  getPlayerTypes: vi.fn().mockResolvedValue(['COMPUTER_MAD', 'COMPUTER_DRAFT']),
  createTable: vi.fn().mockResolvedValue({ ok: true, data: { tableId: 'table-123' } }),
  joinTable: vi.fn().mockResolvedValue({ ok: true }),
}))

describe('CreateTableDialog', () => {
  const onClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders modern create table dialog with navigation tabs', async () => {
    render(<CreateTableDialog onClose={onClose} />)

    expect(screen.getByRole('heading', { name: /Crear Mesa|Create Table/ })).toBeDefined()
    expect(screen.getAllByText(/General/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/Tiempos & Reglas|Timers & Rules/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/Restricciones|Restrictions/)).toBeDefined()
    expect(screen.getAllByText(/Multijugador|Multiplayer/).length).toBeGreaterThanOrEqual(1)
  })

  it('allows navigating to Timing tab and setting custom clocks and mulligans', async () => {
    render(<CreateTableDialog onClose={onClose} />)

    // Switch to Timing step (wizard is linear — clicking stepper jumps)
    const timingTab = screen.getAllByText(/Tiempos & Reglas|Timers & Rules/)[0]
    fireEvent.click(timingTab)

    expect(screen.getAllByText(/Reloj de Prioridad por Jugador/i).length).toBeGreaterThanOrEqual(1)

    // Select 1 free mulligan (chip now shows just number)
    const mulliganChip = screen.getByText('1')
    fireEvent.click(mulliganChip)
    expect(mulliganChip.classList.contains('on')).toBe(true)
  })

  it('allows setting password and permissions in Security tab', async () => {
    render(<CreateTableDialog onClose={onClose} />)

    // Switch to Security tab
    const securityTab = screen.getByText(/Restricciones|Restrictions/)
    fireEvent.click(securityTab)

    expect(screen.getByText(/Contraseña de la Mesa/i)).toBeDefined()
    expect(screen.getAllByText(/Permitir Espectadores|Allow Spectators/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Permitir Rebobinar|Allow Rollbacks/i).length).toBeGreaterThan(0)

    const passwordInput = screen.getByPlaceholderText(/Dejar en blanco para mesa pública|Leave blank for public table/i)
    fireEvent.change(passwordInput, { target: { value: 'secret123' } })
    expect((passwordInput as HTMLInputElement).value).toBe('secret123')
  })

  it('submits createTable with selected options and joins own seat', async () => {
    render(<CreateTableDialog onClose={onClose} />)

    // Fill table name (step 1 General)
    const nameInput = screen.getByPlaceholderText(/Ej. Modern Casual Bo3/)
    fireEvent.change(nameInput, { target: { value: 'Epic Modern Duel' } })

    // Wizard is linear — navigate to last step via Siguiente
    for (let i = 0; i < 5; i++) {
      const nextBtn = screen.queryByRole('button', { name: /Siguiente/ })
      if (nextBtn) fireEvent.click(nextBtn)
    }

    // Click submit button (only visible on last step)
    const submitBtn = screen.getByRole('button', { name: /Crear Mesa/ })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(cmds.createTable).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Epic Modern Duel',
          gameType: 'Two Player Duel',
          deckType: 'Constructed - Modern',
          winsNeeded: 1,
          skillLevel: 'CASUAL',
          spectatorsAllowed: true,
          rollbackTurnsAllowed: true,
        }),
      )
      expect(cmds.joinTable).toHaveBeenCalledWith(
        expect.objectContaining({
          tableId: 'table-123',
          playerType: 'HUMAN',
        }),
      )
      expect(onClose).toHaveBeenCalled()
    })
  })

  it('U2: blocks Siguiente on General with an empty name', async () => {
    render(<CreateTableDialog onClose={onClose} />)

    const nameInput = screen.getByPlaceholderText(/Ej. Modern Casual Bo3/)
    fireEvent.change(nameInput, { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: /Siguiente/ }))

    expect(screen.getByText(/necesita un nombre|needs a name/i)).toBeDefined()
    expect(screen.queryByText(/Mulligans Gratuitos|Free Mulligans/i)).toBeNull()
  })

  it('F7+F2: sends bannedUsers and per-seat skills on submit', async () => {
    render(<CreateTableDialog onClose={onClose} />)

    fireEvent.change(screen.getByPlaceholderText(/Ej. Modern Casual Bo3/), { target: { value: 'Skill Table' } })
    fireEvent.click(screen.getByRole('button', { name: /Siguiente/ }))
    fireEvent.click(screen.getByRole('button', { name: /Siguiente/ }))
    fireEvent.change(
      await screen.findByPlaceholderText(/separados por comas|comma-separated/i),
      { target: { value: 'griefer, troll' } },
    )
    fireEvent.click(screen.getByRole('button', { name: /Siguiente/ }))
    const seatSkill = await screen.findByTestId('seat-skill-0') as HTMLSelectElement
    fireEvent.change(seatSkill, { target: { value: '7' } })

    for (let i = 0; i < 5; i++) {
      const nextBtn = screen.queryByRole('button', { name: /Siguiente/ })
      if (!nextBtn) break
      fireEvent.click(nextBtn)
    }
    fireEvent.click(screen.getByRole('button', { name: /Crear Mesa/ }))

    await waitFor(() => {
      expect(cmds.createTable).toHaveBeenCalledWith(
        expect.objectContaining({
          bannedUsers: ['griefer', 'troll'],
          seatSkills: expect.arrayContaining([7]),
        }),
      )
      expect(cmds.joinTable).toHaveBeenCalledWith(expect.objectContaining({ skill: 2 }))
    })
  })

  it('HUMAN: plaza en espera para humanos, sin bot ni mazo SIM', async () => {
    render(<CreateTableDialog onClose={onClose} />)

    fireEvent.change(screen.getByPlaceholderText(/Ej. Modern Casual Bo3/), { target: { value: 'Humans Only' } })
    fireEvent.click(screen.getByRole('button', { name: /Siguiente/ }))
    fireEvent.click(screen.getByRole('button', { name: /Siguiente/ }))
    fireEvent.click(screen.getByRole('button', { name: /Siguiente/ }))
    const seatType = await screen.findByTestId('seat-type-0') as HTMLSelectElement
    fireEvent.change(seatType, { target: { value: 'HUMAN' } })

    for (let i = 0; i < 5; i++) {
      const nextBtn = screen.queryByRole('button', { name: /Siguiente/ })
      if (!nextBtn) break
      fireEvent.click(nextBtn)
    }
    fireEvent.click(screen.getByRole('button', { name: /Crear Mesa/ }))

    await waitFor(() => {
      expect(cmds.createTable).toHaveBeenCalledWith(
        expect.objectContaining({
          playerTypes: ['HUMAN', 'HUMAN'],
        }),
      )
      const sent = (cmds.createTable as unknown as { mock: { calls: Array<[Record<string, unknown>]> } }).mock.calls[0][0]
      expect(sent.simDecks).toBeUndefined()
      expect(cmds.joinTable).toHaveBeenCalledWith(expect.objectContaining({ playerType: 'HUMAN' }))
      expect(onClose).toHaveBeenCalled()
    })
  })

  it('U8: draft tournament exposes number of rounds', async () => {
    render(<CreateTableDialog onClose={onClose} />)

    const formatSelect = screen.getAllByRole('combobox')[1] as HTMLSelectElement
    fireEvent.change(formatSelect, { target: { value: 'Limited' } })
    fireEvent.click(screen.getByText(/Crear como torneo Draft/i))
    const rounds = screen.getByLabelText(/rondas|rounds/i) as HTMLInputElement
    fireEvent.change(rounds, { target: { value: '5' } })
    expect(rounds.value).toBe('5')
  })
})
