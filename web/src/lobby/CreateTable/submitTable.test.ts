import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as cmds from '../../net/commands'
import { setMyDeck } from '../../state/store'
import type { Deck } from '../decks'
import { requestDeckValidation } from '../DeckIssuesDialog'
import { submitCreateTable, type SubmitTableForm } from './submitTable'

vi.mock('../../net/commands', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../net/commands')>()),
  createTable: vi.fn(),
  joinTable: vi.fn(),
  createTournamentTable: vi.fn(),
  joinTournamentTable: vi.fn(),
  removeTable: vi.fn(async () => ({ ok: true })),
}))

vi.mock('../../state/store', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../state/store')>()),
  setMyDeck: vi.fn(),
}))

vi.mock('../DeckIssuesDialog', () => ({
  requestDeckValidation: vi.fn(async (deck: Deck) => ({ ...deck, name: 'validated' })),
}))

const MY_DECK = { name: 'raw', cards: [], sideboard: [] } as unknown as Deck

const MATCH_RESOLUTION = {
  kind: 'match',
  isDraftLimited: false,
  isConstructedTournament: false,
  isTournament: false,
  normalizedTournamentType: '',
  errorKey: null,
  errorParam: '',
}

const TOURNAMENT_RESOLUTION = {
  kind: 'constructed-tourney',
  isDraftLimited: false,
  isConstructedTournament: true,
  isTournament: true,
  normalizedTournamentType: 'Constructed Elimination',
  errorKey: null,
  errorParam: '',
}

function form(overrides: Partial<SubmitTableForm> = {}): SubmitTableForm {
  return {
    name: 'Duel',
    username: 'alice',
    gameType: 'Two Player Duel',
    deckType: 'Constructed - Modern',
    wins: 1,
    skillLevel: 'CASUAL',
    rated: false,
    draftSetsRaw: '',
    draftBoosters: 3,
    draftConstructionTime: 600,
    draftCubeName: '',
    draftTiming: 'REGULAR',
    numberRounds: 0,
    singleGame: false,
    timeLimit: 'NONE',
    bufferTime: 'NONE',
    freeMulligans: 0,
    mulliganType: 'GAME_DEFAULT',
    customStartLifeEnabled: false,
    customStartLife: 20,
    customStartHandSizeEnabled: false,
    customStartHandSize: 7,
    planeChase: false,
    attackOption: 'LEFT',
    range: 'ALL',
    showRangeAttack: false,
    password: '',
    bannedUsersRaw: '',
    spectatorsAllowed: true,
    rollbackTurnsAllowed: true,
    minimumRating: 0,
    quitRatio: 100,
    edhPowerLevel: 100,
    numPlayers: 2,
    seatConfigs: [],
    humanSeat: true,
    myDeck: MY_DECK,
    simDeck: undefined,
    playerTypesSel: [],
    mySkill: 2,
    skipInitShuffling: false,
    skipStartingPlayerChoice: false,
    isDraftLimited: false,
    isTournament: false,
    tableResolution: MATCH_RESOLUTION,
    findDeck: () => undefined,
    ...overrides,
  } as unknown as SubmitTableForm
}

function io() {
  const handlers = {
    t: ((_scope: string, key: string) => key) as never,
    tError: ((raw: string) => raw) as never,
    setBusy: vi.fn<(v: boolean) => void>(),
    setError: vi.fn<(v: string | null) => void>(),
    onClose: vi.fn<() => void>(),
  }
  return handlers
}

describe('TRN-3: a Swiss tournament is refused without a valid round count', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('TRN-3: a Swiss tournament with a round count below 2 shows the error and creates nothing', async () => {
    const handlers = io()
    await submitCreateTable(
      form({ isTournament: true, numberRounds: 0, tableResolution: { ...TOURNAMENT_RESOLUTION, normalizedTournamentType: 'Constructed Swiss' } as never }),
      handlers,
    )
    expect(cmds.createTournamentTable).not.toHaveBeenCalled()
    expect(handlers.setError).toHaveBeenLastCalledWith('trn_err_rounds')
    expect(handlers.setBusy).toHaveBeenLastCalledWith(false)
  })

  it('TRN-3: an elimination tournament ignores the round count and creates the table', async () => {
    vi.mocked(cmds.createTournamentTable).mockResolvedValueOnce({ ok: true, data: { tableId: 't1' } } as never)
    vi.mocked(cmds.joinTournamentTable).mockResolvedValueOnce({ ok: true } as never)
    await submitCreateTable(form({ isTournament: true, numberRounds: 0, tableResolution: TOURNAMENT_RESOLUTION as never }), io())
    expect(cmds.createTournamentTable).toHaveBeenCalledOnce()
    expect(vi.mocked(cmds.createTournamentTable).mock.calls[0][0]).not.toHaveProperty('numberRounds')
  })
})

const DRAFT_RESOLUTION = {
  kind: 'draft-tourney',
  isDraftLimited: true,
  isConstructedTournament: false,
  isTournament: true,
  normalizedTournamentType: 'Booster Draft Elimination',
  errorKey: null,
  errorParam: '',
}

describe('TRN-5: a limited tournament joins its host without a deck', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('TRN-5: the host join of a draft carries neither a deck nor a deck type', async () => {
    vi.mocked(cmds.createTournamentTable).mockResolvedValueOnce({ ok: true, data: { tableId: 't1' } } as never)
    vi.mocked(cmds.joinTournamentTable).mockResolvedValueOnce({ ok: true } as never)
    await submitCreateTable(
      form({ isTournament: true, isDraftLimited: true, deckType: 'Limited', draftSetsRaw: 'M21, M21, M21', draftBoosters: 3, tableResolution: DRAFT_RESOLUTION as never }),
      io(),
    )
    const join = vi.mocked(cmds.joinTournamentTable).mock.calls[0][0]
    expect(join).toMatchObject({ tableId: 't1', playerType: 'HUMAN' })
    expect(join).not.toHaveProperty('deck')
    expect(join).not.toHaveProperty('deckType')
    expect(requestDeckValidation).not.toHaveBeenCalled()
  })
})

describe('submitCreateTable — saving the deck used to join', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not save the deck when the human join of a match is rejected', async () => {
    vi.mocked(cmds.createTable).mockResolvedValueOnce({ ok: true, data: { tableId: 't1' } } as never)
    vi.mocked(cmds.joinTable).mockResolvedValueOnce({ ok: false, error: 'table full' } as never)
    const handlers = io()
    await submitCreateTable(form(), handlers)
    expect(cmds.joinTable).toHaveBeenCalledTimes(1)
    expect(setMyDeck).not.toHaveBeenCalled()
    expect(handlers.setError).toHaveBeenLastCalledWith('table full')
  })

  it('saves the validated deck, not the raw one, once the human join of a match succeeds', async () => {
    vi.mocked(cmds.createTable).mockResolvedValueOnce({ ok: true, data: { tableId: 't1' } } as never)
    vi.mocked(cmds.joinTable).mockResolvedValueOnce({ ok: true } as never)
    await submitCreateTable(form(), io())
    expect(setMyDeck).toHaveBeenCalledTimes(1)
    expect(vi.mocked(setMyDeck).mock.calls[0][0]).toEqual(expect.objectContaining({ name: 'validated' }))
  })

  it('does not save the deck when the human join of a tournament is rejected', async () => {
    vi.mocked(cmds.createTournamentTable).mockResolvedValueOnce({ ok: true, data: { tableId: 't1' } } as never)
    vi.mocked(cmds.joinTournamentTable).mockResolvedValueOnce({ ok: false, error: 'table full' } as never)
    const handlers = io()
    await submitCreateTable(form({ isTournament: true, tableResolution: TOURNAMENT_RESOLUTION as never }), handlers)
    expect(cmds.joinTournamentTable).toHaveBeenCalledTimes(1)
    expect(setMyDeck).not.toHaveBeenCalled()
    expect(handlers.setError).toHaveBeenLastCalledWith('table full')
  })

  it('saves the validated deck, not the raw one, once the human join of a tournament succeeds', async () => {
    vi.mocked(cmds.createTournamentTable).mockResolvedValueOnce({ ok: true, data: { tableId: 't1' } } as never)
    vi.mocked(cmds.joinTournamentTable).mockResolvedValueOnce({ ok: true } as never)
    await submitCreateTable(form({ isTournament: true, tableResolution: TOURNAMENT_RESOLUTION as never }), io())
    expect(setMyDeck).toHaveBeenCalledTimes(1)
    expect(vi.mocked(setMyDeck).mock.calls[0][0]).toEqual(expect.objectContaining({ name: 'validated' }))
  })
})
