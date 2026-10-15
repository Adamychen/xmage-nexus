import { render, screen, cleanup } from '@testing-library/react'
import { describe, expect, it, vi, afterEach } from 'vitest'
import ReviewTab from './ReviewTab'

vi.mock('../../net/commands', () => ({
  getExpansionsWithBoosters: vi.fn().mockResolvedValue([]),
}))

const stubForm = (over: Record<string, unknown> = {}) => ({
  name: 'Friday night',
  gameType: 'Two Player Duel',
  deckType: 'Constructed - Modern',
  wins: 2,
  skillLevel: 'CASUAL',
  rated: false,
  isTournament: false,
  isDraftLimited: false,
  isLimited: false,
  tournamentType: 'Constructed Swiss',
  numPlayers: 8,
  numberRounds: 0,
  draftBoosters: 3,
  draftConstructionTime: 600,
  draftCubeName: '',
  draftSetsRaw: 'MH3',
  draftTiming: 'REGULAR',
  singleGame: false,
  timeLimit: 'NONE',
  bufferTime: 'NONE',
  freeMulligans: 0,
  mulliganType: 'GAME_DEFAULT',
  customStartLifeEnabled: false,
  customStartHandSizeEnabled: false,
  planeChase: false,
  password: '',
  minimumRating: 0,
  quitRatio: 100,
  bannedUsersRaw: '',
  spectatorsAllowed: true,
  rollbackTurnsAllowed: false,
  humanSeat: true,
  mySkill: 5,
  seatConfigs: [],
  availableDecks: [],
  compatibilityError: null,
  ...over,
}) as any

describe('ReviewTab', () => {
  afterEach(() => cleanup())

  it('lists the match choices without a draft section', () => {
    const { container } = render(<ReviewTab form={stubForm()} />)
    expect(container.querySelector('.create-review')?.textContent).toContain('Friday night')
    expect(screen.getByText('Bo3')).toBeDefined()
    expect(container.querySelectorAll('.create-review-section')).toHaveLength(4)
  })

  it('adds the draft section for a limited draft', () => {
    const { container } = render(<ReviewTab form={stubForm({
      isTournament: true,
      isDraftLimited: true,
      tournamentType: 'Booster Draft Elimination',
    })} />)
    expect(container.querySelectorAll('.create-review-section')).toHaveLength(5)
    expect(container.querySelector('.create-review')?.textContent).toContain('MH3')
  })

  it('says a limited match is not a draft', () => {
    const { container } = render(<ReviewTab form={stubForm({ deckType: 'Limited', isLimited: true })} />)
    expect(container.querySelector('.create-review')?.textContent).toMatch(/40\+/)
  })
})
