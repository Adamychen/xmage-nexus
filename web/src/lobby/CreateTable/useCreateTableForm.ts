import { useEffect, useMemo, useRef, useState } from 'react'
import * as cmds from '../../net/commands'
import type { GameTypeInfo } from '../../net/commands'
import { useStore } from '../../state/store'
import { deckRef, type Deck } from '../decks'
import { isGoodFit, rankDecksForTable, tableFormatProfile } from '../joinDeckFit'
import { useTranslation } from '../../i18n'
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
  defaultTournamentType,
  isDraftTournamentType,
  isConstructedTournamentType,
  normalizeSeatType,
  recommendedFreeMulligans,
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
  healTournamentBranch,
  tournamentTypeForCategory,
  uniformDraftSet,
} from './tableKind'
import type { CreateTableForm } from './types'
import { useDeckChoices } from './useDeckChoices'
import { submitCreateTable, runDemoTable as runDemoTableCommand } from './submitTable'

export type { CreateTableForm } from './types'

/** The form as last persisted (parsed JSON: every field is checked where it is read). */
interface SavedForm {
  tableCategory?: string
  tournamentCategory?: string
  name?: string
  gameType?: string
  deckType?: string
  wins?: number
  skillLevel?: 'BEGINNER' | 'CASUAL' | 'SERIOUS'
  rated?: boolean
  useDraftTournament?: boolean
  numPlayers?: number
  seatConfigs?: unknown
  mySkill?: number
}

function readSaved(): SavedForm {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') ?? {}
  } catch {
    return {}
  }
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
  const goToStep = (tab: CreateTab) => {
    const target = wizardSteps.findIndex((s) => s.id === tab)
    if (target < 0) return
    if (target <= activeIndex) {
      setError(null)
      setActiveTab(tab)
      return
    }
    for (let i = activeIndex; i < target; i++) {
      const err = validateStep(wizardSteps[i].id)
      if (err) {
        setError(err)
        setActiveTab(wizardSteps[i].id)
        return
      }
    }
    setError(null)
    setActiveTab(tab)
  }
  const isLastStep = activeIndex === wizardSteps.length - 1
  const isFirstStep = activeIndex === 0

  const [saved] = useState(readSaved)
  const [gameTypes, setGameTypes] = useState<GameTypeInfo[]>(DEFAULT_GAME_TYPES)
  const [deckTypes, setDeckTypes] = useState<string[]>(DEFAULT_DECK_TYPES)
  const [playerTypes, setPlayerTypes] = useState<string[]>(DEFAULT_PLAYER_TYPES)
  const [tournamentTypes, setTournamentTypes] = useState<string[]>(DEFAULT_TOURNAMENT_TYPES)
  const [draftCubes, setDraftCubes] = useState<string[]>(DEFAULT_DRAFT_CUBES)

  // General tab
  const [tableCategory, setTableCategoryState] = useState<TableCategory>(() => (saved.tableCategory === 'duel' || saved.tableCategory === 'multi' || saved.tableCategory === 'tourney') ? saved.tableCategory as TableCategory : 'duel')
  const [tournamentCategory, setTournamentCategoryState] = useState<TournamentCategory>(() => (saved.tournamentCategory === 'limited' || saved.tournamentCategory === 'constructed') ? saved.tournamentCategory as TournamentCategory : 'limited')

  const [name, setName] = useState<string>(() => saved.name || `${username}'s table`)
  const [gameType, setGameTypeState] = useState<string>(() => saved.gameType || 'Two Player Duel')
  const [deckType, setDeckTypeState] = useState<string>(() => saved.deckType || 'Constructed - Modern')

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
  const [wins, setWins] = useState<number>(() => typeof saved.wins === 'number' && saved.wins >= 1 && saved.wins <= 5 ? saved.wins : 1)
  const [skillLevel, setSkillLevel] = useState<'BEGINNER' | 'CASUAL' | 'SERIOUS'>(() => saved.skillLevel || 'CASUAL')
  const [rated, setRated] = useState<boolean>(() => saved.rated === true)
  const [useDraftTournament, setUseDraftTournament] = useState<boolean>(() => saved.useDraftTournament === true)
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

  const [numPlayers, setNumPlayers] = useState<number>(() => typeof saved.numPlayers === 'number' && saved.numPlayers >= 2 && saved.numPlayers <= 10 ? saved.numPlayers : 2)
  const [seatConfigs, setSeatConfigs] = useState<SeatConfig[]>(() => Array.isArray(saved.seatConfigs) ? (saved.seatConfigs as SeatConfig[]).map((s) => ({ type: normalizeSeatType(String(s.type ?? SIM_SEAT)), deckName: s.deckName, skill: typeof s.skill === 'number' ? s.skill : 2 })) : [])
  const recommendedMulligans = useMemo(
    () => recommendedFreeMulligans(gameType, numPlayers),
    [gameType, numPlayers],
  )
  const lastRecommendedMulligans = useRef<number | null>(null)
  useEffect(() => {
    if (lastRecommendedMulligans.current === recommendedMulligans) return
    lastRecommendedMulligans.current = recommendedMulligans
    setFreeMulligans(recommendedMulligans)
  }, [recommendedMulligans])
  const [mySkill, setMySkill] = useState<number>(() => typeof saved.mySkill === 'number' && saved.mySkill >= 1 && saved.mySkill <= 10 ? saved.mySkill : 2)

  // Seats & Decks tab
  const [humanSeat, setHumanSeat] = useState(true)
  const { availableDecks, decksLoaded, myDeck, simDeck, findDeck, selectMyDeck, selectGlobalSimDeck, adoptStarterDecks: adoptDecks } = useDeckChoices(storeDeck, setSeatConfigs)
  const adoptStarterDecks = (decks: Deck[]) => {
    if (decks.length === 0) return
    const fitting = rankDecksForTable(decks, tableFormatProfile(deckType, gameType))
      .filter(({ fit }) => isGoodFit(fit))
      .map(({ deck }) => deck)
    const mine = fitting[0] ?? decks[0]
    adoptDecks(decks, mine, fitting[1] ?? mine)
  }
  const [playerTypesSel, setPlayerTypesSel] = useState<string[]>(['SIM'])

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
        const add = Array.from({ length: target - prev.length }, () => ({ type: defaultSeatType, deckName: simDeck ? deckRef(simDeck) : '', skill: 2 }))
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
    const synced = tournamentTypeForCategory({ tableCategory, tournamentCategory, tournamentType })
    if (synced !== tournamentType) setTournamentType(synced)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableCategory, tournamentCategory, tournamentType])

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
  const setSeatDeck = (idx: number, deckRefValue: string) => {
    setSeatConfigs((prev) => prev.map((s, i) => (i === idx ? { ...s, deckName: deckRefValue } : s)))
  }
  const setSeatSkill = (idx: number, skill: number) => {
    setSeatConfigs((prev) => prev.map((s, i) => (i === idx ? { ...s, skill: Math.min(10, Math.max(1, skill)) } : s)))
  }

  const runDemoTable = () => runDemoTableCommand({ skipInitShuffling, skipStartingPlayerChoice }, { setBusy, onClose })

  const submit = () => submitCreateTable({
    name, gameType, deckType, wins, skillLevel, rated,
    draftSetsRaw, draftBoosters, draftConstructionTime, draftCubeName, draftTiming,
    numberRounds, singleGame, timeLimit, bufferTime, freeMulligans, mulliganType,
    customStartLifeEnabled, customStartLife, customStartHandSizeEnabled, customStartHandSize,
    planeChase, attackOption, range, password, bannedUsersRaw, spectatorsAllowed,
    rollbackTurnsAllowed, minimumRating, quitRatio, edhPowerLevel, numPlayers,
    seatConfigs, humanSeat, myDeck, simDeck, playerTypesSel, mySkill,
    skipInitShuffling, skipStartingPlayerChoice, showRangeAttack, isDraftLimited,
    isTournament, compatibilityError,
    username, tableResolution, findDeck,
  }, { t, tError, setBusy, setError, onClose })

  return {
    wizardSteps,
    activeTab,
    setActiveTab,
    activeIndex,
    goNext,
    goPrev,
    goToStep,
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
    recommendedMulligans,
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
    decksLoaded,
    adoptStarterDecks,
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
