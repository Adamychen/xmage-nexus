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
  getTournamentTypes: vi.fn().mockResolvedValue([
    'Constructed Elimination',
    'Constructed Swiss',
    'Booster Draft Elimination',
    'Booster Draft Swiss',
    'Sealed Elimination',
    'Sealed Swiss',
  ]),
  getDraftCubes: vi.fn().mockResolvedValue([]),
  getExpansionsWithBoosters: vi.fn().mockResolvedValue([
    { code: 'MH3', name: 'Modern Horizons 3', releaseDate: 1718064000000 },
    { code: 'BLB', name: 'Bloomburrow', releaseDate: 1722556800000 },
    { code: 'M21', name: 'Core Set 2021', releaseDate: 1593734400000 },
  ]),
  createTable: vi.fn().mockResolvedValue({ ok: true, data: { tableId: 'table-123' } }),
  joinTable: vi.fn().mockResolvedValue({ ok: true }),
  createTournamentTable: vi.fn().mockResolvedValue({ ok: true, data: { tableId: 'table-t1' } }),
  joinTournamentTable: vi.fn().mockResolvedValue({ ok: true }),
  validateDeck: vi.fn().mockResolvedValue({ ok: true }),
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
    const typeSelect = screen.getAllByRole('combobox')[2] as HTMLSelectElement
    fireEvent.change(typeSelect, { target: { value: 'Booster Draft Swiss' } })
    const rounds = screen.getByLabelText(/rondas|rounds/i) as HTMLInputElement
    fireEvent.change(rounds, { target: { value: '5' } })
    expect(rounds.value).toBe('5')
  })

  it('T3: number of rounds only shows for Swiss tournament types', async () => {
    render(<CreateTableDialog onClose={onClose} />)

    const formatSelect = screen.getAllByRole('combobox')[1] as HTMLSelectElement
    fireEvent.change(formatSelect, { target: { value: 'Limited' } })
    fireEvent.click(screen.getByText(/Crear como torneo Draft/i))
    // default is now a valid server draft type → timing shown, rounds hidden
    const typeSelect = screen.getAllByRole('combobox')[2] as HTMLSelectElement
    expect(typeSelect.value).toBe('Booster Draft Elimination')
    expect(screen.getByLabelText(/Draft pick time|Tiempo por pick/i)).toBeDefined()
    expect(screen.queryByLabelText(/rondas|rounds/i)).toBeNull()
    fireEvent.change(typeSelect, { target: { value: 'Booster Draft Swiss' } })
    expect(screen.getByLabelText(/rondas|rounds/i)).toBeDefined()
    fireEvent.change(typeSelect, { target: { value: 'Sealed Elimination' } })
    expect(screen.queryByLabelText(/rondas|rounds/i)).toBeNull()
  })

  it('T2: draft tournament sends lobby flags (skill/rated/rollback/clocks/single)', async () => {
    render(<CreateTableDialog onClose={onClose} />)

    fireEvent.change(screen.getByPlaceholderText(/Ej. Modern Casual Bo3/), { target: { value: 'Draft Night' } })
    const formatSelect = screen.getAllByRole('combobox')[1] as HTMLSelectElement
    fireEvent.change(formatSelect, { target: { value: 'Limited' } })
    fireEvent.click(screen.getByText(/Crear como torneo Draft/i))
    fireEvent.click(screen.getByText(/Jugar como partida única|Play as single game/i))
    // Sin bots: todos los asientos en HUMANO (los bots no entregan el mazo construido)
    fireEvent.click(
      screen
        .getAllByRole('button', { name: /Multijugador/ })
        .find((b) => (b as HTMLElement).classList.contains('wizard-step'))!,
    )
    const seatTypeSelect = await screen.findByTestId('seat-type-0') as HTMLSelectElement
    fireEvent.change(seatTypeSelect, { target: { value: 'HUMAN' } })

    for (let i = 0; i < 6; i++) {
      const nextBtn = screen.queryByRole('button', { name: /Siguiente/ })
      if (!nextBtn) break
      fireEvent.click(nextBtn)
    }
    fireEvent.click(screen.getByRole('button', { name: /Crear torneo|Create Draft/i }))

    await waitFor(() => {
      expect(cmds.createTournamentTable).toHaveBeenCalledWith(
        expect.objectContaining({
          tournamentType: 'Booster Draft Elimination',
          deckType: 'Limited',
          skillLevel: 'CASUAL',
          rated: false,
          rollbackTurnsAllowed: true,
          timeLimit: 'MIN__25',
          isSingleMultiplayerGame: true,
          playerTypes: ['HUMAN', 'HUMAN'],
        }),
      )
      const sent = (cmds.createTournamentTable as unknown as { mock: { calls: Array<[Record<string, unknown>]> } }).mock.calls[0][0]
      expect(sent.bufferTime).toBeUndefined()
      expect(sent.bannedUsers).toBeUndefined()
      expect(sent.minimumRating).toBeUndefined()
      expect(cmds.joinTournamentTable).toHaveBeenCalledWith(expect.objectContaining({ tableId: 'table-t1' }))
      expect(onClose).toHaveBeenCalled()
    })
  })

  it('T6: draft tournament sends timing only for Draft types', async () => {
    render(<CreateTableDialog onClose={onClose} />)

    fireEvent.change(screen.getByPlaceholderText(/Ej. Modern Casual Bo3/), { target: { value: 'Timed Draft' } })
    const formatSelect = screen.getAllByRole('combobox')[1] as HTMLSelectElement
    fireEvent.change(formatSelect, { target: { value: 'Limited' } })
    fireEvent.click(screen.getByText(/Crear como torneo Draft/i))
    const typeSelect = screen.getAllByRole('combobox')[2] as HTMLSelectElement
    fireEvent.change(typeSelect, { target: { value: 'Sealed Swiss' } })
    // timing selector hidden for non-draft types
    expect(screen.queryByText(/Draft pick time|Tiempo por pick/i)).toBeNull()
    fireEvent.change(typeSelect, { target: { value: 'Booster Draft Elimination' } })
    const timingSelect = screen.getByLabelText(/Draft pick time|Tiempo por pick/i) as HTMLSelectElement
    expect(timingSelect.value).toBe('REGULAR')
    fireEvent.change(timingSelect, { target: { value: 'PROFESSIONAL' } })
    // Sin bots: todos los asientos en HUMANO (los bots no entregan el mazo construido)
    fireEvent.click(
      screen
        .getAllByRole('button', { name: /Multijugador/ })
        .find((b) => (b as HTMLElement).classList.contains('wizard-step'))!,
    )
    const seatTypeSelectT6 = await screen.findByTestId('seat-type-0') as HTMLSelectElement
    fireEvent.change(seatTypeSelectT6, { target: { value: 'HUMAN' } })

    for (let i = 0; i < 6; i++) {
      const nextBtn = screen.queryByRole('button', { name: /Siguiente/ })
      if (!nextBtn) break
      fireEvent.click(nextBtn)
    }
    fireEvent.click(screen.getByRole('button', { name: /Crear torneo|Create Draft/i }))

    await waitFor(() => {
      const sent = (cmds.createTournamentTable as unknown as { mock: { calls: Array<[Record<string, unknown>]> } }).mock.calls[0][0]
      expect((sent.limitedOptions as Record<string, unknown>).timing).toBe('PROFESSIONAL')
    })
  })

  it('T7: mode switcher and quick presets configure table correctly', async () => {
    render(<CreateTableDialog onClose={onClose} />)

    // Click Commander 4P preset
    fireEvent.click(screen.getByRole('button', { name: /Commander 4P/i }))
    const gameTypeSelect = screen.getAllByRole('combobox')[0] as HTMLSelectElement
    expect(gameTypeSelect.value).toBe('Commander Free For All')

    // Click Modern Swiss (8P) preset
    fireEvent.click(screen.getByRole('button', { name: /Modern Swiss \(8P\)/i }))
    expect(screen.getByRole('button', { name: /^Construido/i }).classList.contains('active')).toBe(true)
  })

  it('T8: constructed tournament creates tournament table with constructed format and joins with deck', async () => {
    render(<CreateTableDialog onClose={onClose} />)

    fireEvent.change(screen.getByPlaceholderText(/Ej. Modern Casual Bo3/), { target: { value: 'Modern Swiss 8P' } })
    // Click Modern Swiss (8P) preset
    fireEvent.click(screen.getByRole('button', { name: /Modern Swiss \(8P\)/i }))

    for (let i = 0; i < 6; i++) {
      const nextBtn = screen.queryByRole('button', { name: /Siguiente/ })
      if (!nextBtn) break
      fireEvent.click(nextBtn)
    }

    fireEvent.click(screen.getByRole('button', { name: /Crear torneo/i }))

    await waitFor(() => {
      expect(cmds.createTournamentTable).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Modern Swiss 8P',
          tournamentType: 'Constructed Swiss',
          deckType: 'Constructed - Modern',
          limited: false,
          winsNeeded: 2,
        }),
      )
      expect(cmds.joinTournamentTable).toHaveBeenCalledWith(
        expect.objectContaining({
          tableId: 'table-t1',
          playerType: 'HUMAN',
          deckType: 'Constructed - Modern',
        }),
      )
      expect(onClose).toHaveBeenCalled()
    })
  })

  it('T9: handles server returning TournamentTypeView objects without throwing t.startsWith is not a function', async () => {
    // Simulate real server returning TournamentTypeView objects instead of plain strings
    vi.mocked(cmds.getTournamentTypes).mockResolvedValueOnce([
      { name: 'Constructed Elimination', minPlayers: 2, maxPlayers: 16 } as unknown as string,
      { name: 'Constructed Swiss', minPlayers: 2, maxPlayers: 16 } as unknown as string,
      { name: 'Booster Draft', minPlayers: 4, maxPlayers: 8 } as unknown as string,
    ])

    render(<CreateTableDialog onClose={onClose} />)

    // Wait for the async effect to resolve getTournamentTypes
    await waitFor(() => {
      expect(cmds.getTournamentTypes).toHaveBeenCalled()
    })

    // Switch to tourney mode - should not throw t.startsWith error
    fireEvent.click(screen.getByRole('button', { name: /^Torneo/i }))

    expect(screen.getByRole('button', { name: /^Draft \/ Limit/i })).toBeDefined()
    expect(screen.getByRole('button', { name: /^Construido/i })).toBeDefined()
  })

  it('T10: links gameType and deckType to prevent incompatible combinations', async () => {
    render(<CreateTableDialog onClose={onClose} />)

    const gameTypeSelect = screen.getAllByRole('combobox')[0] as HTMLSelectElement
    const formatSelect = screen.getAllByRole('combobox')[1] as HTMLSelectElement

    // Initial state: Two Player Duel -> Constructed - Modern
    expect(gameTypeSelect.value).toBe('Two Player Duel')
    expect(formatSelect.value).toBe('Constructed - Modern')
    // Format options should NOT include Commander
    const initialOptions = Array.from(formatSelect.options).map((o) => o.value)
    expect(initialOptions).toContain('Constructed - Modern')
    expect(initialOptions).toContain('Constructed - Standard')
    expect(initialOptions).not.toContain('Variant Magic - Commander')

    // Change gameType to Commander Free For All
    fireEvent.change(gameTypeSelect, { target: { value: 'Commander Free For All' } })
    expect(formatSelect.value).toBe('Variant Magic - Commander')

    // Format options should now ONLY include Commander formats
    const commanderOptions = Array.from(formatSelect.options).map((o) => o.value)
    expect(commanderOptions).toContain('Variant Magic - Commander')
    expect(commanderOptions).not.toContain('Constructed - Modern')
    expect(commanderOptions).not.toContain('Constructed - Standard')

    // Switch back to Two Player Duel
    fireEvent.change(gameTypeSelect, { target: { value: 'Two Player Duel' } })
    expect(formatSelect.value).toBe('Constructed - Modern')
    const duelOptions = Array.from(formatSelect.options).map((o) => o.value)
    expect(duelOptions).toContain('Constructed - Modern')
    expect(duelOptions).not.toContain('Variant Magic - Commander')
  })

  it('T11: mode selector cards contain title and description in separate container elements', () => {
    const { container } = render(<CreateTableDialog onClose={onClose} />)
    const cards = container.querySelectorAll('.create-mode-card')
    expect(cards.length).toBe(3)
    cards.forEach((card) => {
      const content = card.querySelector('.create-mode-card-content')
      expect(content).not.toBeNull()
      const title = content?.querySelector('.create-mode-card-title')
      const desc = content?.querySelector('.create-mode-card-desc')
      expect(title).not.toBeNull()
      expect(desc).not.toBeNull()
    })
  })

  it('T12: DraftSetsSelector allows picking popular chips and configuring boosters with full visibility', async () => {
    render(<CreateTableDialog onClose={onClose} />)

    // Switch to Limited Draft mode
    const formatSelect = screen.getAllByRole('combobox')[1] as HTMLSelectElement
    fireEvent.change(formatSelect, { target: { value: 'Limited' } })
    fireEvent.click(screen.getByText(/Crear como torneo Draft/i))

    // Popular chips should be visible
    expect(screen.getByText('MH3')).toBeDefined()
    expect(screen.getByText('BLB')).toBeDefined()

    // Clicking MH3 chip sets all boosters
    fireEvent.click(screen.getByText('MH3'))
    const setsInput = screen.getByPlaceholderText(/Ej. M21, MH3, BLB/) as HTMLInputElement
    expect(setsInput.value).toContain('MH3')

    // Switch to custom per-booster mode
    fireEvent.click(screen.getByRole('button', { name: /Personalizar cada sobre/i }))
    expect(screen.getByText(/Sobre 1/i)).toBeDefined()
    expect(screen.getByText(/Sobre 2/i)).toBeDefined()
    expect(screen.getByText(/Sobre 3/i)).toBeDefined()
  })

  it('T13: creates table with COMPUTER_MAD and joins both the bot and human player', async () => {    render(<CreateTableDialog onClose={onClose} />)

    const nameInput = screen.getByPlaceholderText(/Ej. Modern Casual Bo3/)
    fireEvent.change(nameInput, { target: { value: 'Mad Bot Duel' } })

    // Navigate to Plazas/Seats tab (step 4)
    for (let i = 0; i < 3; i++) {
      const nextBtn = screen.queryByRole('button', { name: /Siguiente/ })
      if (nextBtn) fireEvent.click(nextBtn)
    }

    // Set seat 0 (seat-type-0) to COMPUTER_MAD
    const seatTypeSelect = await screen.findByTestId('seat-type-0') as HTMLSelectElement
    fireEvent.change(seatTypeSelect, { target: { value: 'COMPUTER_MAD' } })
    expect(seatTypeSelect.value).toBe('COMPUTER_MAD')

    // Navigate to Summary / last step
    const nextBtn = screen.queryByRole('button', { name: /Siguiente/ })
    if (nextBtn) fireEvent.click(nextBtn)

    // Submit
    const submitBtn = screen.getByRole('button', { name: /Crear Mesa/ })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(cmds.createTable).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Mad Bot Duel',
          playerTypes: ['HUMAN', 'COMPUTER_MAD'],
        }),
      )
      expect(cmds.joinTable).toHaveBeenCalledWith(
        expect.objectContaining({
          tableId: 'table-123',
          playerType: 'COMPUTER_MAD',
          playerName: 'Computer',
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

  it('LM1: match Limited muestra resumen honesto y al marcar draft enseña sobres', async () => {
    const { container } = render(<CreateTableDialog onClose={onClose} />)
    const summaryText = () =>
      container.querySelector('.create-table-summary-strip')?.textContent ?? ''

    const formatSelect = screen.getAllByRole('combobox')[1] as HTMLSelectElement
    fireEvent.change(formatSelect, { target: { value: 'Limited' } })
    expect(screen.getByText(/no genera sobres/)).toBeDefined()
    expect(screen.queryByPlaceholderText(/Ej\. M21, MH3, BLB/)).toBeNull()
    expect(summaryText()).toMatch(/mazos de 40\+/)

    fireEvent.click(screen.getByText(/Crear como torneo Draft/i))
    expect(screen.queryByText(/no genera sobres/)).toBeNull()
    expect(screen.getByPlaceholderText(/Ej\. M21, MH3, BLB/)).toBeDefined()
    expect(summaryText()).toMatch(/Draft 3× M21/)
    expect(summaryText()).toMatch(/10 minutos/)
  })

  it('T14: el wizard abre con el set repetido por sobre y lo sincroniza al cambiar de sobres', async () => {
    render(<CreateTableDialog onClose={onClose} />)
    const formatSelect = screen.getAllByRole('combobox')[1] as HTMLSelectElement
    fireEvent.change(formatSelect, { target: { value: 'Limited' } })
    fireEvent.click(screen.getByText(/Crear como torneo Draft/i))
    const setsInput = screen.getByPlaceholderText(/Ej\. M21, MH3, BLB/) as HTMLInputElement
    expect(setsInput.value).toBe('M21, M21, M21')
    const boosterSelect = screen
      .getAllByRole('combobox')
      .find((s) => (s as HTMLSelectElement).value === '3') as HTMLSelectElement
    expect(boosterSelect).toBeDefined()
    fireEvent.change(boosterSelect, { target: { value: '6' } })
    expect(setsInput.value).toBe('M21, M21, M21, M21, M21, M21')
    fireEvent.change(setsInput, { target: { value: 'M21, MH3, DSK' } })
    fireEvent.change(boosterSelect, { target: { value: '3' } })
    expect(setsInput.value).toBe('M21, MH3, DSK')
  })

  it('T15: draft con bots se bloquea con aviso (no llegan a rondas)', async () => {
    render(<CreateTableDialog onClose={onClose} />)
    fireEvent.change(screen.getByPlaceholderText(/Ej. Modern Casual Bo3/), { target: { value: 'Draft con bots' } })
    const formatSelect = screen.getAllByRole('combobox')[1] as HTMLSelectElement
    fireEvent.change(formatSelect, { target: { value: 'Limited' } })
    fireEvent.click(screen.getByText(/Crear como torneo Draft/i))

    for (let i = 0; i < 6; i++) {
      const nextBtn = screen.queryByRole('button', { name: /Siguiente/ })
      if (!nextBtn) break
      fireEvent.click(nextBtn)
    }
    fireEvent.click(screen.getByRole('button', { name: /Crear torneo|Create Draft/i }))

    await waitFor(() => {
      expect(screen.getByText(/no llegan a rondas/)).toBeDefined()
    })
    expect(cmds.createTournamentTable).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })
})
