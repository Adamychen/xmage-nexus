import type { Dispatch, SetStateAction } from 'react'
import type { GameTypeInfo } from '../../net/commands'
import type { Deck } from '../decks'
import type { CreateTab, DraftTiming, SeatConfig, TableCategory, TournamentCategory, WizardStep } from './constants'

/** Everything the Create Table wizard tabs read and change (see `useCreateTableForm`). */
export interface CreateTableForm {
  wizardSteps: WizardStep[]
  activeTab: CreateTab
  setActiveTab: (t: CreateTab) => void
  activeIndex: number
  goNext: () => void
  goPrev: () => void
  goToStep: (t: CreateTab) => void
  isLastStep: boolean
  isFirstStep: boolean
  tableCategory: TableCategory
  setTableCategory: (v: TableCategory) => void
  tournamentCategory: TournamentCategory
  setTournamentCategory: (v: TournamentCategory) => void
  applyMode: (cat: TableCategory) => void
  applyPreset: (key: string) => void
  gameTypes: GameTypeInfo[]
  deckTypes: string[]
  playerTypes: string[]
  tournamentTypes: string[]
  draftCubes: string[]
  name: string
  setName: (v: string) => void
  gameType: string
  setGameType: (v: string) => void
  deckType: string
  setDeckType: (v: string) => void
  wins: number
  setWins: (v: number) => void
  skillLevel: 'BEGINNER' | 'CASUAL' | 'SERIOUS'
  setSkillLevel: (v: 'BEGINNER' | 'CASUAL' | 'SERIOUS') => void
  rated: boolean
  setRated: (v: boolean) => void
  useDraftTournament: boolean
  setUseDraftTournament: (v: boolean) => void
  draftSetsRaw: string
  setDraftSetsRaw: (v: string) => void
  draftBoosters: 3 | 6
  setDraftBoosters: (v: 3 | 6) => void
  draftConstructionTime: number
  setDraftConstructionTime: (v: number) => void
  tournamentType: string
  setTournamentType: (v: string) => void
  numberRounds: number
  setNumberRounds: (v: number) => void
  draftCubeName: string
  setDraftCubeName: (v: string) => void
  draftTiming: DraftTiming
  setDraftTiming: (v: DraftTiming) => void
  singleGame: boolean
  setSingleGame: (v: boolean) => void
  timeLimit: string
  setTimeLimit: (v: string) => void
  bufferTime: string
  setBufferTime: (v: string) => void
  freeMulligans: number
  setFreeMulligans: (v: number) => void
  recommendedMulligans: number
  mulliganType: string
  setMulliganType: (v: string) => void
  customStartLifeEnabled: boolean
  setCustomStartLifeEnabled: (v: boolean) => void
  customStartLife: number
  setCustomStartLife: (v: number) => void
  customStartHandSizeEnabled: boolean
  setCustomStartHandSizeEnabled: (v: boolean) => void
  customStartHandSize: number
  setCustomStartHandSize: (v: number) => void
  planeChase: boolean
  setPlaneChase: (v: boolean) => void
  attackOption: string
  setAttackOption: (v: string) => void
  range: string
  setRange: (v: string) => void
  password: string
  setPassword: (v: string) => void
  showPassword: boolean
  setShowPassword: (v: boolean) => void
  bannedUsersRaw: string
  setBannedUsersRaw: (v: string) => void
  spectatorsAllowed: boolean
  setSpectatorsAllowed: (v: boolean) => void
  rollbackTurnsAllowed: boolean
  setRollbackTurnsAllowed: (v: boolean) => void
  minimumRating: number
  setMinimumRating: (v: number) => void
  quitRatio: number
  setQuitRatio: (v: number) => void
  edhPowerLevel: number
  setEdhPowerLevel: (v: number) => void
  numPlayers: number
  setNumPlayers: (v: number) => void
  seatConfigs: SeatConfig[]
  setSeatConfigs: Dispatch<SetStateAction<SeatConfig[]>>
  humanSeat: boolean
  setHumanSeat: (v: boolean) => void
  availableDecks: Deck[]
  decksLoaded: boolean
  adoptStarterDecks: (decks: Deck[]) => void
  myDeck: Deck | null
  selectMyDeck: (name: string) => void
  simDeck: Deck | null
  selectGlobalSimDeck: (name: string) => void
  playerTypesSel: string[]
  toggleAi: (pt: string) => void
  applySeatTypeToAll: (pt: string) => void
  setSeatType: (idx: number, type: string) => void
  setSeatDeck: (idx: number, deckName: string) => void
  setSeatSkill: (idx: number, skill: number) => void
  mySkill: number
  setMySkill: (v: number) => void
  skipInitShuffling: boolean
  setSkipInitShuffling: (v: boolean) => void
  skipStartingPlayerChoice: boolean
  setSkipStartingPlayerChoice: (v: boolean) => void
  busy: boolean
  error: string | null
  effectiveGameTypes: GameTypeInfo[]
  effectiveDeckTypes: string[]
  selectedGameTypeInfo: GameTypeInfo | undefined
  isMultiplayerGame: boolean
  showRangeAttack: boolean
  isLimited: boolean
  isDraftLimited: boolean
  isTournament: boolean
  isConstructedTournament: boolean
  compatibilityError: string | null
  validateStep: (tab: CreateTab) => string | null
  submit: () => Promise<void>
  runDemoTable: () => Promise<void>
}
