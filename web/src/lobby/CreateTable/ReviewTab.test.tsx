import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi, afterEach } from 'vitest'
import ReviewTab from './ReviewTab'

vi.mock('../../net/commands', () => ({
  getExpansionsWithBoosters: vi.fn().mockResolvedValue([]),
}))

const ALL_STEPS = ['general', 'draft', 'timing', 'security', 'seats', 'review'].map((id) => ({ id }))

const stubForm = (over: Record<string, unknown> = {}) => ({
  wizardSteps: ALL_STEPS,
  goToStep: vi.fn(),
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

  it('jumps to the step that owns a section when its edit control is clicked', () => {
    const goToStep = vi.fn()
    const { container } = render(<ReviewTab form={stubForm({ goToStep })} />)
    const sections = container.querySelectorAll('.create-review-section')
    fireEvent.click(sections[1].querySelector('button')!)
    expect(goToStep).toHaveBeenLastCalledWith('timing')
    fireEvent.click(sections[3].querySelector('button')!)
    expect(goToStep).toHaveBeenLastCalledWith('seats')
    expect(goToStep).toHaveBeenCalledTimes(2)
  })

  it('names each edit control after its section title', () => {
    const { container } = render(<ReviewTab form={stubForm()} />)
    container.querySelectorAll('.create-review-section').forEach((section) => {
      const title = section.querySelector('.create-review-title')!.firstChild!.textContent!
      expect(section.querySelector('button')!.getAttribute('aria-label')).toContain(title)
    })
  })

  it('hides the edit control for a step the wizard does not have', () => {
    const { container } = render(<ReviewTab form={stubForm({
      wizardSteps: ALL_STEPS.filter((step) => step.id !== 'timing'),
    })} />)
    const sections = container.querySelectorAll('.create-review-section')
    expect(sections[1].querySelector('button')).toBeNull()
    expect(sections[0].querySelector('button')).not.toBeNull()
  })

  it('says a limited match is not a draft', () => {
    const { container } = render(<ReviewTab form={stubForm({ deckType: 'Limited', isLimited: true })} />)
    expect(container.querySelector('.create-review')?.textContent).toMatch(/40\+/)
  })
})
