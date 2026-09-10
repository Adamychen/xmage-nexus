import { useEffect, useMemo, useState } from 'react'
import * as cmds from '../../net/commands'
import type { GameTypeInfo } from '../../net/commands'
import { setMyDeck, useStore } from '../../state/store'
import { getAllAvailableDecks, DEFAULT_DECK, type Deck } from '../decks'
import { requestDeckValidation } from '../DeckIssuesDialog'
import { useTranslation } from '../../i18n'
import { prepareDeckForXMage } from '../../decks/deckNormalize'
import {
  isLimitedDeckType,
  validateDeckGameCompatibility,
  isGameAndDeckCompatible,
  getDefaultDeckTypeForGame,
  getDefaultGameTypeForDeck,
} from '../../decks/formatRules'
import {
  STORAGE_KEY,
  DEFAULT_GAME_TYPES,
  DEFAULT_DECK_TYPES,
  DEFAULT_PLAYER_TYPES,
  DEFAULT_TOURNAMENT_TYPES,
  DEFAULT_DRAFT_CUBES,
  DEFAULT_DRAFT_TOURNAMENT_TYPE,
  SIM_SEAT,
  aiSeatTypes,
  buildLimitedOptions,
  defaultTournamentType,
  isDraftTournamentType,
  isConstructedTournamentType,
  isHumanSeatType,
  isNativeAiSeatType,
  isSimSeatType,
  normalizeSeatType,
  parseLimitedSetCodes,
  type CreateTab,
  type DraftTiming,
  type SeatConfig,
  type WizardStep,
  type TableCategory,
  type TournamentCategory,
  WIZARD_STEPS_BASE,
} from './constants'
import {
  resolveTableKind,
  clampNumPlayers,
  defaultSeatTypeFor,
  computeTournamentSeats,
  computeMatchSeats,
  buildTournamentLimitedOptions,
  buildCreateTournamentArgs,
  buildCreateMatchArgs,
  healTournamentBranch,
  validateDraftSets,
  uniformDraftSet,
  limitedTourneyHasAiSeats,
} from './tableKind'
import { isRandomPacksType } from './RandomPacksSelector'

export interface CreateTableForm {
  wizardSteps: WizardStep[]
  activeTab: CreateTab
  setActiveTab: (t: CreateTab) => void
  activeIndex: number
  goNext: () => void
  goPrev: () => void
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
  setSeatConfigs: React.Dispatch<React.SetStateAction<SeatConfig[]>>
  humanSeat: boolean
  setHumanSeat: (v: boolean) => void
  availableDecks: Deck[]
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

export function useCreateTableForm(onClose: () => void): CreateTableForm {
  const { t, tError } = useTranslation()
  const username = useStore((s) => s.conn?.username ?? 'player')
  const storeDeck = useStore((s) => s.myDeck)

  const wizardSteps: WizardStep[] = useMemo(() => {
    const steps = [...WIZARD_STEPS_BASE]
    if (import.meta.env.DEV) steps.push({ id: 'dev', icon: 'settings', labelKey: '', titleFallback: 'Dev' })
    return steps
  }, [])

  const [activeTab, setActiveTab] = useState<CreateTab>('general')
  const activeIndex = useMemo(() => {
    const idx = wizardSteps.findIndex((s) => s.id === activeTab)
    return idx >= 0 ? idx : 0
  }, [wizardSteps, activeTab])

  const goToIndex = (idx: number) => {
    if (idx < 0 || idx >= wizardSteps.length) return
    setActiveTab(wizardSteps[idx].id)
  }
  const goNext = () => {
    const err = validateStep(activeTab)
    if (err) {
      setError(err)
      return
    }
    setError(null)
    goToIndex(activeIndex + 1)
  }
  const goPrev = () => goToIndex(activeIndex - 1)
  const isLastStep = activeIndex === wizardSteps.length - 1
  const isFirstStep = activeIndex === 0

  const [gameTypes, setGameTypes] = useState<GameTypeInfo[]>(DEFAULT_GAME_TYPES)
  const [deckTypes, setDeckTypes] = useState<string[]>(DEFAULT_DECK_TYPES)
  const [playerTypes, setPlayerTypes] = useState<string[]>(DEFAULT_PLAYER_TYPES)
  const [tournamentTypes, setTournamentTypes] = useState<string[]>(DEFAULT_TOURNAMENT_TYPES)
  const [draftCubes, setDraftCubes] = useState<string[]>(DEFAULT_DRAFT_CUBES)

  // General tab
  const [tableCategory, setTableCategoryState] = useState<TableCategory>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const j = JSON.parse(raw)
        if (j.tableCategory === 'duel' || j.tableCategory === 'multi' || j.tableCategory === 'tourney') {
          return j.tableCategory as TableCategory
        }
      }
    } catch {}
    return 'duel'
  })
  const [tournamentCategory, setTournamentCategoryState] = useState<TournamentCategory>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const j = JSON.parse(raw)
        if (j.tournamentCategory === 'limited' || j.tournamentCategory === 'constructed') {
          return j.tournamentCategory as TournamentCategory
        }
      }
    } catch {}
    return 'limited'
  })

  const [name, setName] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const j = JSON.parse(raw)
        if (j.name) return j.name as string
      }
    } catch {}
    return `${username}'s table`
  })
  const [gameType, setGameTypeState] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const j = JSON.parse(raw)
        if (j.gameType) return j.gameType as string
      }
    } catch {}
    return 'Two Player Duel'
  })
  const [deckType, setDeckTypeState] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const j = JSON.parse(raw)
        if (j.deckType) return j.deckType as string
      }
    } catch {}
    return 'Constructed - Modern'
  })

  const setGameType = (newGt: string) => {
    setGameTypeState(newGt)
    if (!isGameAndDeckCompatible(deckType, newGt)) {
      setDeckTypeState(getDefaultDeckTypeForGame(newGt))
    }
  }

  const setDeckType = (newDt: string) => {
    setDeckTypeState(newDt)
    if (!isLimitedDeckType(newDt)) setUseDraftTournament(false)
    if (!isGameAndDeckCompatible(newDt, gameType)) {
      setGameTypeState(getDefaultGameTypeForDeck(newDt, numPlayers))
    }
  }
  const [wins, setWins] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const j = JSON.parse(raw)
        if (typeof j.wins === 'number' && j.wins >= 1 && j.wins <= 5) return j.wins as number
      }
    } catch {}
    return 1
  })
  const [skillLevel, setSkillLevel] = useState<'BEGINNER' | 'CASUAL' | 'SERIOUS'>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const j = JSON.parse(raw)
        if (j.skillLevel) return j.skillLevel as 'BEGINNER' | 'CASUAL' | 'SERIOUS'
      }
    } catch {}
    return 'CASUAL'
  })
  const [rated, setRated] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const j = JSON.parse(raw)
        if (typeof j.rated === 'boolean') return j.rated as boolean
      }
    } catch {}
    return false
  })
  const [useDraftTournament, setUseDraftTournament] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const j = JSON.parse(raw)
        if (typeof j.useDraftTournament === 'boolean') return j.useDraftTournament as boolean
      }
    } catch {}
    return false
  })
  const [draftSetsRaw, setDraftSetsRaw] = useState('M21, M21, M21')
  const [draftBoostersState, setDraftBoostersState] = useState<3 | 6>(3)
  const setDraftBoosters = (v: 3 | 6) => {
    setDraftBoostersState(v)
    setDraftSetsRaw((prev) => {
      const uniform = uniformDraftSet(prev)
      return uniform ? Array(v).fill(uniform).join(', ') : prev
    })
  }
  const draftBoosters = draftBoostersState
  const [draftConstructionTime, setDraftConstructionTime] = useState(600)
  const [tournamentType, setTournamentTypeState] = useState<string>(DEFAULT_DRAFT_TOURNAMENT_TYPE)
  const setTournamentType = (v: unknown) => {
    const s = typeof v === 'string' ? v : (v as { name?: string })?.name ?? DEFAULT_DRAFT_TOURNAMENT_TYPE
    setTournamentTypeState(s || DEFAULT_DRAFT_TOURNAMENT_TYPE)
  }
  const [numberRounds, setNumberRounds] = useState(0)
  const [draftCubeName, setDraftCubeName] = useState('')
  const [draftTiming, setDraftTiming] = useState<DraftTiming>('REGULAR')
  const [singleGame, setSingleGame] = useState(false)

  const setTableCategory = (cat: TableCategory) => {
    setTableCategoryState(cat)
    if (cat === 'duel') {
      setUseDraftTournament(false)
      setGameTypeState('Two Player Duel')
      setDeckTypeState((curr) => (isGameAndDeckCompatible(curr, 'Two Player Duel') ? curr : 'Constructed - Modern'))
      setNumPlayers(2)
    } else if (cat === 'multi') {
      setUseDraftTournament(false)
      const multiType = gameTypes.find((g) => g.maxPlayers > 2)?.name ?? 'Commander Free For All'
      setGameTypeState(multiType)
      setDeckTypeState((curr) => (isGameAndDeckCompatible(curr, multiType) ? curr : 'Variant Magic - Commander'))
      if (numPlayers < 3) setNumPlayers(4)
    } else if (cat === 'tourney') {
      if (tournamentCategory === 'limited') {
        setUseDraftTournament(true)
        setDeckTypeState('Limited')
        setGameTypeState('Two Player Duel')
        if (!tournamentType || !isDraftTournamentType(tournamentType)) {
          setTournamentType(DEFAULT_DRAFT_TOURNAMENT_TYPE)
        }
      } else {
        setUseDraftTournament(false)
        if (isLimitedDeckType(deckType)) setDeckTypeState('Constructed - Modern')
        setGameTypeState('Two Player Duel')
        if (!isConstructedTournamentType(tournamentType)) {
          setTournamentType('Constructed Swiss')
        }
      }
    }
  }

  const setTournamentCategory = (cat: TournamentCategory) => {
    setTournamentCategoryState(cat)
    if (cat === 'limited') {
      setUseDraftTournament(true)
      setDeckTypeState('Limited')
      if (!tournamentType || isConstructedTournamentType(tournamentType)) {
        setTournamentType(DEFAULT_DRAFT_TOURNAMENT_TYPE)
      }
    } else {
      setUseDraftTournament(false)
      if (isLimitedDeckType(deckType)) setDeckTypeState('Constructed - Modern')
      if (!isConstructedTournamentType(tournamentType)) {
        setTournamentType('Constructed Swiss')
      }
    }
  }

  const applyMode = (cat: TableCategory) => {
    setTableCategory(cat)
  }

  const setUseDraftTournamentChecked = (v: boolean) => {
    setUseDraftTournament(v)
    if (tableCategory === 'tourney') setTournamentCategory(v ? 'limited' : 'constructed')
  }

  const applyPreset = (key: string) => {
    if (key === 'modern_bo3') {
      setTableCategoryState('duel')
      setUseDraftTournament(false)
      setGameTypeState('Two Player Duel')
      setDeckTypeState('Constructed - Modern')
      setWins(2)
      setNumPlayers(2)
    } else if (key === 'commander_4p') {
      setTableCategoryState('multi')
      setUseDraftTournament(false)
      setGameTypeState('Commander Free For All')
      setDeckTypeState('Variant Magic - Commander')
      setNumPlayers(4)
      setWins(1)
    } else if (key === 'draft_8p') {
      setTableCategoryState('tourney')
      setTournamentCategoryState('limited')
      setUseDraftTournament(true)
      setTournamentType(DEFAULT_DRAFT_TOURNAMENT_TYPE)
      setDeckTypeState('Limited')
      setGameTypeState('Two Player Duel')
      setNumPlayers(8)
      setWins(2)
      setDraftBoosters(3)
      setDraftSetsRaw('MH3, MH3, MH3')
    } else if (key === 'modern_swiss_8p') {
      setTableCategoryState('tourney')
      setTournamentCategoryState('constructed')
      setUseDraftTournament(false)
      setTournamentType('Constructed Swiss')
      setDeckTypeState('Constructed - Modern')
      setGameTypeState('Two Player Duel')
      setNumPlayers(8)
      setWins(2)
    }
  }

  // Timing tab
  const [timeLimit, setTimeLimit] = useState('MIN__25')
  const [bufferTime, setBufferTime] = useState('NONE')
  const [freeMulligans, setFreeMulligans] = useState(0)
  const [mulliganType, setMulliganType] = useState('GAME_DEFAULT')
  const [customStartLifeEnabled, setCustomStartLifeEnabled] = useState(false)
  const [customStartLife, setCustomStartLife] = useState(20)
  const [customStartHandSizeEnabled, setCustomStartHandSizeEnabled] = useState(false)
  const [customStartHandSize, setCustomStartHandSize] = useState(7)
  const [planeChase, setPlaneChase] = useState(false)
  const [attackOption, setAttackOption] = useState('LEFT')
  const [range, setRange] = useState('ALL')

  // Security & Permissions tab
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [bannedUsersRaw, setBannedUsersRaw] = useState('')
  const [spectatorsAllowed, setSpectatorsAllowed] = useState(true)
  const [rollbackTurnsAllowed, setRollbackTurnsAllowed] = useState(true)
  const [minimumRating, setMinimumRating] = useState(0)
  const [quitRatio, setQuitRatio] = useState(100)
  const [edhPowerLevel, setEdhPowerLevel] = useState(100)

  const [numPlayers, setNumPlayers] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const j = JSON.parse(raw)
        if (typeof j.numPlayers === 'number' && j.numPlayers >= 2 && j.numPlayers <= 10) return j.numPlayers as number
      }
    } catch {}
    return 2
  })
  const [seatConfigs, setSeatConfigs] = useState<SeatConfig[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const j = JSON.parse(raw)
        if (Array.isArray(j.seatConfigs)) return (j.seatConfigs as SeatConfig[]).map((s) => ({ type: normalizeSeatType(String(s.type ?? SIM_SEAT)), deckName: s.deckName, skill: typeof s.skill === 'number' ? s.skill : 2 }))
      }
    } catch {}
    return []
  })
  const [mySkill, setMySkill] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const j = JSON.parse(raw)
        if (typeof j.mySkill === 'number' && j.mySkill >= 1 && j.mySkill <= 10) return j.mySkill as number
      }
    } catch {}
    return 2
  })

  // Seats & Decks tab
  const [humanSeat, setHumanSeat] = useState(true)
  const [availableDecks, setAvailableDecks] = useState<Deck[]>(() => getAllAvailableDecks())
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const mod = await import('../../decks/storage')
        const st = mod.getDeckStorage()
        const v2 = await st.list()
        if (cancelled) return
        const maps = new Map<string, Deck>()
        for (const d of v2) {
          const deck: Deck = { name: d.name, cards: d.cards, sideboard: d.sideboard }
          maps.set(deck.name, deck)
        }
        for (const d of getAllAvailableDecks()) {
          if (!maps.has(d.name)) maps.set(d.name, d)
        }
        setAvailableDecks([...maps.values()])
      } catch {}
    })()
    return () => { cancelled = true }
  }, [])
  const [myDeck, setMyDeckState] = useState<Deck | null>(() => {
    if (storeDeck) return storeDeck
    const avail = getAllAvailableDecks()
    return avail[0] ?? null
  })
  const [simDeck, setSimDeck] = useState<Deck | null>(() => getAllAvailableDecks()[0] ?? null)
  const [playerTypesSel, setPlayerTypesSel] = useState<string[]>(['SIM'])

  // Si la lista de mazos llega tarde (storage async) y no hay selección, coger el primero.
  useEffect(() => {
    if (availableDecks.length === 0) return
    if (!myDeck) setMyDeckState(availableDecks[0])
    if (!simDeck) setSimDeck(availableDecks[0])
  }, [availableDecks])

  // Dev / Test tab
  const [skipInitShuffling, setSkipInitShuffling] = useState(false)
  const [skipStartingPlayerChoice, setSkipStartingPlayerChoice] = useState(false)

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const [g, d, p, tt, dc] = await Promise.all([
          cmds.getGameTypes().catch(() => [] as GameTypeInfo[]),
          cmds.getDeckTypes().catch(() => [] as string[]),
          cmds.getPlayerTypes().catch(() => [] as string[]),
          cmds.getTournamentTypes().catch(() => [] as string[]),
          cmds.getDraftCubes().catch(() => [] as string[]),
        ])
        if (!active) return
        if (g && g.length > 0) {
          setGameTypes(g)
          if (!g.some((x) => x.name === gameType)) setGameType(g[0].name)
        }
        if (d && d.length > 0) {
          setDeckTypes(d)
          if (!d.some((x) => x === deckType)) setDeckType(d[0])
        }
        if (p && p.length > 0) {
          setPlayerTypes(aiSeatTypes(p))
        }
        if (tt && tt.length > 0) {
          const names = tt
            .map((item: unknown) => (typeof item === 'string' ? item : (item as { name?: string })?.name ?? ''))
            .filter((s): s is string => typeof s === 'string' && s.length > 0)
          if (names.length > 0) {
            setTournamentTypes(names)
            if (!names.includes(tournamentType)) setTournamentType(defaultTournamentType(names))
          }
        }
        if (dc && dc.length > 0) {
          setDraftCubes(dc)
          if (draftCubeName && !dc.includes(draftCubeName)) setDraftCubeName('')
        }
      } catch (err) {
        console.warn('Could not fetch server match types, using defaults', err)
      }
    })()
    return () => {
      active = false
    }
  }, [])

  const effectiveGameTypes = useMemo(() => {
    const list = [...gameTypes]
    if (gameType && !list.some((g) => g.name === gameType)) {
      list.unshift({ name: gameType, minPlayers: 2, maxPlayers: 2 })
    }
    return list
  }, [gameTypes, gameType])

  useEffect(() => {
    if (!isGameAndDeckCompatible(deckType, gameType)) {
      setDeckTypeState(getDefaultDeckTypeForGame(gameType))
    }
  }, [])

  const effectiveDeckTypes = useMemo(() => {
    const compatible = deckTypes.filter((d) => isGameAndDeckCompatible(d, gameType))
    const list = compatible.length > 0 ? compatible : deckTypes
    if (deckType && !list.includes(deckType) && isGameAndDeckCompatible(deckType, gameType)) {
      list.unshift(deckType)
    }
    return list
  }, [deckTypes, deckType, gameType])

  const selectedGameTypeInfo = useMemo(() => {
    return effectiveGameTypes.find((g) => g.name === gameType)
  }, [effectiveGameTypes, gameType])

  const isMultiplayerGame = useMemo(() => {
    return (selectedGameTypeInfo?.maxPlayers ?? 2) > 2 || gameType.toLowerCase().includes('commander')
  }, [selectedGameTypeInfo, gameType])

  const showRangeAttack = useMemo(() => {
    const useRange = (selectedGameTypeInfo as { useRange?: unknown } | undefined)?.useRange
    const useAttackOption = (selectedGameTypeInfo as { useAttackOption?: unknown } | undefined)?.useAttackOption
    if (typeof useRange === 'boolean' || typeof useAttackOption === 'boolean') {
      return Boolean(useRange || useAttackOption)
    }
    return isMultiplayerGame
  }, [selectedGameTypeInfo, isMultiplayerGame])

  const isLimited = isLimitedDeckType(deckType)
  const tableResolution = resolveTableKind({
    tableCategory,
    tournamentCategory,
    useDraftTournament,
    deckType,
    tournamentType,
    knownTournamentTypes: tournamentTypes,
  })
  const { isDraftLimited, isConstructedTournament, isTournament } = tableResolution
  const normalizedTournamentType = tableResolution.normalizedTournamentType

  const compatibilityError = useMemo(() => {
    if (isDraftLimited) return null
    return validateDeckGameCompatibility(deckType, gameType)
  }, [deckType, gameType, isDraftLimited])

  const validateStep = (tab: CreateTab): string | null => {
    if (tab === 'general') {
      if (!name.trim()) return t('lobby', 'create_err_name_required')
      if (compatibilityError && !isDraftLimited) return compatibilityError
      return null
    }
    if (tab === 'seats') {
      const occupants = (humanSeat ? 1 : 0) + seatConfigs.length
      if (occupants < 1) return t('lobby', 'create_err_no_seats')
      if (humanSeat && !myDeck && !isDraftLimited) return t('lobby', 'create_err_no_deck')
      return null
    }
    return null
  }

  useEffect(() => {
    const min = selectedGameTypeInfo?.minPlayers ?? 2
    const max = selectedGameTypeInfo?.maxPlayers ?? 2
    const clamped = clampNumPlayers(numPlayers, { draft: isDraftLimited, tourney: isTournament }, min, max)
    if (clamped !== numPlayers) setNumPlayers(clamped)
  }, [selectedGameTypeInfo, numPlayers, isDraftLimited, isTournament])

  useEffect(() => {
    const target = Math.max(0, numPlayers - (humanSeat ? 1 : 0))
    const defaultSeatType = defaultSeatTypeFor(isDraftLimited)
    setSeatConfigs((prev) => {
      if (prev.length === target) return prev
      if (prev.length < target) {
        const add = Array.from({ length: target - prev.length }, () => ({ type: defaultSeatType, deckName: simDeck?.name ?? '', skill: 2 }))
        return [...prev, ...add]
      }
      return prev.slice(0, target)
    })
  }, [numPlayers, humanSeat, simDeck?.name, isDraftLimited])

  useEffect(() => {
    try {
      const payload = { tableCategory, tournamentCategory, useDraftTournament, name, gameType, deckType, wins, skillLevel, rated, numPlayers, seatConfigs, mySkill, bannedUsersRaw, numberRounds, freeMulligans, mulliganType, customStartLifeEnabled, customStartLife, customStartHandSizeEnabled, customStartHandSize, planeChase }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    } catch {}
  }, [tableCategory, tournamentCategory, useDraftTournament, name, gameType, deckType, wins, skillLevel, rated, numPlayers, seatConfigs, mySkill, bannedUsersRaw, numberRounds, freeMulligans, mulliganType, customStartLifeEnabled, customStartLife, customStartHandSizeEnabled, customStartHandSize, planeChase])

  useEffect(() => {
    const healed = healTournamentBranch({ tableCategory, tournamentCategory, useDraftTournament })
    if (healed.useDraftTournament !== useDraftTournament) setUseDraftTournament(healed.useDraftTournament)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (import.meta.env.DEV && tableCategory === 'tourney' && useDraftTournament !== (tournamentCategory === 'limited')) {
      console.error('[wizard] invariante draft roto', { tableCategory, tournamentCategory, useDraftTournament })
    }
  })

  const toggleAi = (pt: string) => {
    const n = normalizeSeatType(pt)
    setPlayerTypesSel((cur) => (cur.includes(n) ? cur.filter((x) => x !== n) : [...cur, n]))
  }
  const applySeatTypeToAll = (pt: string) => {
    const n = normalizeSeatType(pt)
    setSeatConfigs((prev) => prev.map((s) => ({ ...s, type: n })))
  }
  const setSeatType = (idx: number, type: string) => {
    const n = normalizeSeatType(type)
    setSeatConfigs((prev) => prev.map((s, i) => (i === idx ? { ...s, type: n } : s)))
  }
  const setSeatDeck = (idx: number, deckName: string) => {
    setSeatConfigs((prev) => prev.map((s, i) => (i === idx ? { ...s, deckName } : s)))
  }
  const setSeatSkill = (idx: number, skill: number) => {
    setSeatConfigs((prev) => prev.map((s, i) => (i === idx ? { ...s, skill: Math.min(10, Math.max(1, skill)) } : s)))
  }
  const selectMyDeck = (deckName: string) => {
    setMyDeckState(availableDecks.find((d) => d.name === deckName) ?? null)
  }
  const selectGlobalSimDeck = (deckName: string) => {
    const d = availableDecks.find((x) => x.name === deckName) ?? null
    setSimDeck(d)
    if (d) setSeatConfigs((prev) => prev.map((s) => !isHumanSeatType(s.type) ? { ...s, deckName: d.name } : s))
  }

  const runDemoTable = async () => {
    setBusy(true)
    try {
      const res = await cmds.createTable({
        name: 'Demo IA vs IA',
        gameType: 'Two Player Duel',
        deckType: 'Constructed - Modern',
        winsNeeded: 1,
        playerTypes: ['SIM', 'SIM'],
        simDecks: [DEFAULT_DECK, DEFAULT_DECK],
        skipInitShuffling,
        skipStartingPlayerChoice,
      })
      if (res.ok) {
        const data = res.data as { tableId?: string; TableId?: string } | undefined
        const tableId = data?.tableId ?? data?.TableId
        if (tableId) {
          const started = await cmds.startMatch(tableId)
          if (started.ok) {
            await cmds.watchTable(tableId)
          }
        }
        onClose()
      }
    } finally {
      setBusy(false)
    }
  }

  const submit = async () => {
    if (!name.trim()) {
      setError(t('errors','create_table_failed') + ': nombre requerido')
      return
    }
    if (compatibilityError && !isDraftLimited) {
      setError(compatibilityError)
      return
    }
    if (humanSeat && !myDeck && !isDraftLimited) {
      setError(t('lobby', 'create_err_no_deck'))
      setBusy(false)
      return
    }
    setBusy(true)
    setError(null)
    const resolveSimDeck = (deckName?: string): Deck | null => {
      if (deckName) {
        const found = availableDecks.find((d) => d.name === deckName)
        if (found) return found
      }
      return simDeck ?? myDeck ?? DEFAULT_DECK
    }
    if (isTournament) {
      if (tableResolution.kind === 'invalid') {
        setError(t('lobby', 'create_err_bad_tournament_type', { type: tableResolution.errorParam }))
        setBusy(false)
        return
      }
      const { playerTypesFinal, effectiveSeatTypes } = computeTournamentSeats({
        seatConfigs,
        playerTypesSel,
        numPlayers,
        humanSeat,
        draft: isDraftLimited,
      })
      if (isDraftLimited && limitedTourneyHasAiSeats(playerTypesFinal)) {
        setError(t('errors', 'draft_bots_no_submit'))
        setBusy(false)
        return
      }

      let limitedOptions: ReturnType<typeof buildLimitedOptions> | undefined
      if (isDraftLimited) {
        const setsError = validateDraftSets(draftSetsRaw, draftBoosters, {
          cube: draftCubeName.trim().length > 0,
          random: isRandomPacksType(normalizedTournamentType),
        })
        if (setsError) {
          setError(t('errors', setsError, {
            need: draftBoosters,
            have: parseLimitedSetCodes(draftSetsRaw).length,
          }))
          setBusy(false)
          return
        }
        limitedOptions = buildTournamentLimitedOptions({
          draftSetsRaw,
          draftBoosters,
          draftConstructionTime,
          draftCubeName,
          draftTiming,
          tournamentType: normalizedTournamentType,
        })
      }

      let finalMyDeck = null as null | Awaited<ReturnType<typeof requestDeckValidation>>
      if (!isDraftLimited && humanSeat && myDeck) {
        const fixed = await requestDeckValidation(prepareDeckForXMage(myDeck, deckType, gameType))
        if (!fixed) {
          setBusy(false)
          return
        }
        finalMyDeck = fixed
      }

      const tArgs = buildCreateTournamentArgs({
        name,
        username,
        tournamentType: normalizedTournamentType,
        gameType,
        deckType,
        draft: isDraftLimited,
        limitedOptions,
        playerTypesFinal,
        password,
        spectatorsAllowed,
        wins,
        numberRounds,
        skillLevel,
        rated,
        rollbackTurnsAllowed,
        timeLimit,
        bufferTime,
        minimumRating,
        quitRatio,
        bannedUsersRaw,
        singleGame,
      })
      const res = await cmds.createTournamentTable(tArgs as Record<string, unknown>)
      setBusy(false)
      if (!res.ok) {
        const code = (res as { errorCode?: string }).errorCode
        const raw = res.error || code || t('errors','draft_create_failed')
        setError(tError(raw, 'createTournamentTable', code) ?? raw)
        return
      }
      const tableId = (res.data as { tableId?: string } | null)?.tableId
      if (tableId) {
        const tournamentBotSeats = effectiveSeatTypes
          .map((type, idx) => ({ type, idx, cfg: seatConfigs[idx] }))
          .filter((s) => isNativeAiSeatType(s.type))
        let botCounter = 1
        for (const bot of tournamentBotSeats) {
          const botName = botCounter === 1 && tournamentBotSeats.length === 1 ? 'Computer' : `Computer ${botCounter}`
          botCounter++
          let botDeck: unknown = undefined
          if (!isDraftLimited) {
            const base = resolveSimDeck(bot.cfg?.deckName)
            if (base) {
              const fixed = await requestDeckValidation(prepareDeckForXMage(base, deckType, gameType))
              botDeck = fixed ?? undefined
            }
            if (!botDeck) {
              setError(t('lobby', 'create_err_no_deck'))
              return
            }
          }
          const joinBot = await cmds.joinTournamentTable({
            tableId,
            playerName: botName,
            playerType: normalizeSeatType(bot.type),
            skill: bot.cfg?.skill ?? 2,
            ...(botDeck ? { deck: botDeck as any, deckType, gameType } : {}),
            password: password.trim() || undefined,
          })
          if (!joinBot.ok) {
            const code = (joinBot as { errorCode?: string }).errorCode
            const raw = joinBot.error || code || t('errors', 'join_table_failed')
            setError(tError(raw, 'joinTournamentTable', code) ?? raw)
            return
          }
        }
        if (humanSeat) {
          const join = await cmds.joinTournamentTable({
            tableId,
            playerName: username,
            playerType: 'HUMAN',
            skill: mySkill,
            ...(finalMyDeck ? { deck: finalMyDeck, deckType, gameType } : {}),
            password: password.trim() || undefined,
          })
          if (finalMyDeck && myDeck) {
            setMyDeck(myDeck)
          }
          if (!join.ok) {
            const code = (join as { errorCode?: string }).errorCode
            const raw = join.error || code || t('errors','join_table_failed')
            setError(tError(raw, 'joinTournamentTable', code) ?? raw)
            return
          }
        }
      }
      onClose()
      return
    }
    const { playerTypesFinal, effectiveSeatTypes } = computeMatchSeats({
      seatConfigs,
      playerTypesSel,
      numPlayers,
      humanSeat,
    })
    const simSeats = effectiveSeatTypes.filter(isSimSeatType).length
    const nativeBotSeats = effectiveSeatTypes
      .map((type, idx) => ({ type, idx, cfg: seatConfigs[idx] }))
      .filter((s) => isNativeAiSeatType(s.type))

    // pre-validación contra la BD de cartas del servidor (humano y asientos SIM)
    // Transformación invisible para Commander: XMage espera comandante en banquillo
    let finalMyDeck = null as null | Awaited<ReturnType<typeof requestDeckValidation>>
    if (humanSeat && myDeck) {
      const fixed = await requestDeckValidation(prepareDeckForXMage(myDeck, deckType, gameType))
      if (!fixed) {
        setBusy(false)
        return
      }
      finalMyDeck = fixed
    }

    let finalSimDeck = null as null | Awaited<ReturnType<typeof requestDeckValidation>>
    if (simSeats > 0) {
      const base = resolveSimDeck()
      if (!base) {
        setError(t('lobby', 'create_err_no_deck'))
        setBusy(false)
        return
      }
      const fixed = await requestDeckValidation(prepareDeckForXMage(base, deckType, gameType))
      if (!fixed) {
        setBusy(false)
        return
      }
      finalSimDeck = fixed
    }

    const simDecksBySeat: NonNullable<typeof finalSimDeck>[] = []
    if (simSeats > 0 && finalSimDeck) {
      for (let i = 0; i < effectiveSeatTypes.length; i++) {
        if (isSimSeatType(effectiveSeatTypes[i])) {
          const cfg = seatConfigs[i]
          const deckForSeat = resolveSimDeck(cfg?.deckName)
          if (!deckForSeat) {
            setError(t('lobby', 'create_err_no_deck'))
            setBusy(false)
            return
          }
          const xmageDeckForSeat = prepareDeckForXMage(deckForSeat as Deck, deckType, gameType)
          simDecksBySeat.push(xmageDeckForSeat as unknown as NonNullable<typeof finalSimDeck>)
        }
      }
      while (simDecksBySeat.length < simSeats) simDecksBySeat.push(finalSimDeck)
    }

    const nativeBotDecks: Record<number, NonNullable<typeof finalSimDeck>> = {}
    if (nativeBotSeats.length > 0 && !isLimitedDeckType(deckType)) {
      for (const bot of nativeBotSeats) {
        const base = resolveSimDeck(bot.cfg?.deckName)
        if (!base) {
          setError(t('lobby', 'create_err_no_deck'))
          setBusy(false)
          return
        }
        const fixed = await requestDeckValidation(prepareDeckForXMage(base, deckType, gameType))
        if (!fixed) {
          setBusy(false)
          return
        }
        nativeBotDecks[bot.idx] = fixed
      }
    }

    const seatSkills = effectiveSeatTypes.map((_, i) => seatConfigs[i]?.skill ?? 2)
    const res = await cmds.createTable(buildCreateMatchArgs({
      name,
      username,
      gameType,
      deckType,
      wins,
      playerTypesFinal,
      seatSkills,
      password,
      skillLevel,
      rated,
      spectatorsAllowed,
      rollbackTurnsAllowed,
      timeLimit,
      bufferTime,
      freeMulligans,
      showRangeAttack,
      attackOption,
      range,
      minimumRating,
      quitRatio,
      edhPowerLevel,
      bannedUsersRaw,
      mulliganType,
      customStartLifeEnabled,
      customStartLife,
      customStartHandSizeEnabled,
      customStartHandSize,
      planeChase,
      simDecks: simDecksBySeat,
      skipInitShuffling,
      skipStartingPlayerChoice,
      dev: import.meta.env.DEV,
    }) as any)

    setBusy(false)
    if (!res.ok) {
      const code = (res as { errorCode?: string }).errorCode
      const raw = res.error || code || t('errors','create_table_failed')
      setError(tError(raw, 'createTable', code) ?? raw)
      return
    }

    const tableId = (res.data as { tableId?: string } | null)?.tableId
    if (tableId) {
      let botCounter = 1
      for (const bot of nativeBotSeats) {
        const botName = botCounter === 1 && nativeBotSeats.length === 1 ? 'Computer' : `Computer ${botCounter}`
        botCounter++
        const botDeck = nativeBotDecks[bot.idx] ?? finalSimDeck ?? finalMyDeck ?? DEFAULT_DECK
        const joinBot = await cmds.joinTable({
          tableId,
          playerName: botName,
          playerType: normalizeSeatType(bot.type),
          skill: bot.cfg?.skill ?? 2,
          deck: botDeck as any,
          deckType,
          gameType,
          password: password.trim() || undefined,
        })
        if (!joinBot.ok) {
          const code = (joinBot as { errorCode?: string }).errorCode
          const raw = joinBot.error || code || t('errors', 'join_table_failed')
          setError(tError(raw, 'joinTable', code) ?? raw)
          return
        }
      }

      if (humanSeat && finalMyDeck) {
        const join = await cmds.joinTable({
          tableId,
          playerName: username,
          playerType: 'HUMAN',
          skill: mySkill,
          deck: finalMyDeck,
          deckType,
          gameType,
          password: password.trim() || undefined,
        })
        setMyDeck(myDeck)
        if (!join.ok) {
          const code = (join as { errorCode?: string }).errorCode
          const raw = join.error || code || t('errors','join_table_failed')
          setError(tError(raw, 'joinTable', code) ?? raw)
          return
        }
      }
    }
    onClose()
  }

  return {
    wizardSteps,
    activeTab,
    setActiveTab,
    activeIndex,
    goNext,
    goPrev,
    isLastStep,
    isFirstStep,
    gameTypes,
    deckTypes,
    playerTypes,
    tournamentTypes,
    draftCubes,
    name,
    setName,
    gameType,
    setGameType,
    deckType,
    setDeckType,
    wins,
    setWins,
    skillLevel,
    setSkillLevel,
    rated,
    setRated,
    useDraftTournament,
    setUseDraftTournament: setUseDraftTournamentChecked,
    draftSetsRaw,
    setDraftSetsRaw,
    draftBoosters,
    setDraftBoosters,
    draftConstructionTime,
    setDraftConstructionTime,
    tournamentType,
    setTournamentType,
    numberRounds,
    setNumberRounds,
    draftCubeName,
    setDraftCubeName,
    draftTiming,
    setDraftTiming,
    singleGame,
    setSingleGame,
    timeLimit,
    setTimeLimit,
    bufferTime,
    setBufferTime,
    freeMulligans,
    setFreeMulligans,
    mulliganType,
    setMulliganType,
    customStartLifeEnabled,
    setCustomStartLifeEnabled,
    customStartLife,
    setCustomStartLife,
    customStartHandSizeEnabled,
    setCustomStartHandSizeEnabled,
    customStartHandSize,
    setCustomStartHandSize,
    planeChase,
    setPlaneChase,
    attackOption,
    setAttackOption,
    range,
    setRange,
    password,
    setPassword,
    showPassword,
    setShowPassword,
    bannedUsersRaw,
    setBannedUsersRaw,
    spectatorsAllowed,
    setSpectatorsAllowed,
    rollbackTurnsAllowed,
    setRollbackTurnsAllowed,
    minimumRating,
    setMinimumRating,
    quitRatio,
    setQuitRatio,
    edhPowerLevel,
    setEdhPowerLevel,
    numPlayers,
    setNumPlayers,
    seatConfigs,
    setSeatConfigs,
    humanSeat,
    setHumanSeat,
    availableDecks,
    myDeck,
    selectMyDeck,
    simDeck,
    selectGlobalSimDeck,
    playerTypesSel,
    toggleAi,
    applySeatTypeToAll,
    setSeatType,
    setSeatDeck,
    setSeatSkill,
    mySkill,
    setMySkill,
    skipInitShuffling,
    setSkipInitShuffling,
    skipStartingPlayerChoice,
    setSkipStartingPlayerChoice,
    busy,
    error,
    effectiveGameTypes,
    effectiveDeckTypes,
    selectedGameTypeInfo,
    isMultiplayerGame,
    showRangeAttack,
    tableCategory,
    setTableCategory,
    tournamentCategory,
    setTournamentCategory,
    applyMode,
    applyPreset,
    isLimited,
    isDraftLimited,
    isTournament,
    isConstructedTournament,
    compatibilityError,
    validateStep,
    submit,
    runDemoTable,
  }
}
