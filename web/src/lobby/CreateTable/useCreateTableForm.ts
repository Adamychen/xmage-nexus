import { useEffect, useMemo, useState } from 'react'
import * as cmds from '../../net/commands'
import type { GameTypeInfo } from '../../net/commands'
import { setMyDeck, useStore } from '../../state/store'
import { getAllAvailableDecks, DEFAULT_DECK, LANDS_DECK, type Deck } from '../decks'
import { requestDeckValidation } from '../DeckIssuesDialog'
import { useTranslation } from '../../i18n'
import { prepareDeckForXMage } from '../../decks/deckNormalize'
import { isLimitedDeckType, validateDeckGameCompatibility } from '../../decks/formatRules'
import {
  STORAGE_KEY,
  DEFAULT_GAME_TYPES,
  DEFAULT_DECK_TYPES,
  DEFAULT_PLAYER_TYPES,
  DEFAULT_TOURNAMENT_TYPES,
  DEFAULT_DRAFT_CUBES,
  HUMAN_SEAT,
  SIM_SEAT,
  aiSeatTypes,
  buildLimitedOptions,
  isDraftTournamentType,
  isSimSeatType,
  normalizeSeatType,
  parseLimitedSetCodes,
  type CreateTab,
  type DraftTiming,
  type SeatConfig,
  type WizardStep,
  WIZARD_STEPS_BASE,
} from './constants'

export interface CreateTableForm {
  wizardSteps: WizardStep[]
  activeTab: CreateTab
  setActiveTab: (t: CreateTab) => void
  activeIndex: number
  goNext: () => void
  goPrev: () => void
  isLastStep: boolean
  isFirstStep: boolean
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
  myDeck: Deck
  selectMyDeck: (name: string) => void
  simDeck: Deck
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
  const [gameType, setGameType] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const j = JSON.parse(raw)
        if (j.gameType) return j.gameType as string
      }
    } catch {}
    return 'Two Player Duel'
  })
  const [deckType, setDeckType] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const j = JSON.parse(raw)
        if (j.deckType) return j.deckType as string
      }
    } catch {}
    return 'Constructed - Modern'
  })
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
  const [useDraftTournament, setUseDraftTournament] = useState(false)
  const [draftSetsRaw, setDraftSetsRaw] = useState('M21')
  const [draftBoosters, setDraftBoosters] = useState<3 | 6>(3)
  const [draftConstructionTime, setDraftConstructionTime] = useState(600)
  const [tournamentType, setTournamentType] = useState('Booster Draft')
  const [numberRounds, setNumberRounds] = useState(0)
  const [draftCubeName, setDraftCubeName] = useState('')
  const [draftTiming, setDraftTiming] = useState<DraftTiming>('REGULAR')
  const [singleGame, setSingleGame] = useState(false)

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
  const [myDeck, setMyDeckState] = useState<Deck>(storeDeck ?? DEFAULT_DECK)
  const [simDeck, setSimDeck] = useState<Deck>(LANDS_DECK)
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
          setTournamentTypes(tt)
          if (!tt.includes(tournamentType)) setTournamentType(tt[0])
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

  const effectiveDeckTypes = useMemo(() => {
    const list = [...deckTypes]
    if (deckType && !list.includes(deckType)) {
      list.unshift(deckType)
    }
    return list
  }, [deckTypes, deckType])

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
  const isDraftLimited = deckType === 'Limited' && useDraftTournament

  const compatibilityError = useMemo(() => validateDeckGameCompatibility(deckType, gameType), [deckType, gameType])

  const validateStep = (tab: CreateTab): string | null => {
    if (tab === 'general') {
      if (!name.trim()) return t('lobby', 'create_err_name_required')
      if (compatibilityError) return compatibilityError
      return null
    }
    if (tab === 'seats') {
      const occupants = (humanSeat ? 1 : 0) + seatConfigs.length
      if (occupants < 1) return t('lobby', 'create_err_no_seats')
      return null
    }
    return null
  }

  useEffect(() => {
    const min = selectedGameTypeInfo?.minPlayers ?? 2
    const max = selectedGameTypeInfo?.maxPlayers ?? 2
    if (numPlayers < min) setNumPlayers(min)
    else if (numPlayers > max) setNumPlayers(max)
  }, [selectedGameTypeInfo, numPlayers])

  useEffect(() => {
    const target = Math.max(0, numPlayers - (humanSeat ? 1 : 0))
    setSeatConfigs((prev) => {
      if (prev.length === target) return prev
      if (prev.length < target) {
        const add = Array.from({ length: target - prev.length }, () => ({ type: 'SIM', deckName: simDeck.name, skill: 2 }))
        return [...prev, ...add]
      }
      return prev.slice(0, target)
    })
  }, [numPlayers, humanSeat, simDeck.name])

  useEffect(() => {
    try {
      const payload = { name, gameType, deckType, wins, skillLevel, rated, numPlayers, seatConfigs, mySkill, bannedUsersRaw, numberRounds, freeMulligans, mulliganType, customStartLifeEnabled, customStartLife, customStartHandSizeEnabled, customStartHandSize, planeChase }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    } catch {}
  }, [name, gameType, deckType, wins, skillLevel, rated, numPlayers, seatConfigs, mySkill, bannedUsersRaw, numberRounds, freeMulligans, mulliganType, customStartLifeEnabled, customStartLife, customStartHandSizeEnabled, customStartHandSize, planeChase])

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
    setMyDeckState(availableDecks.find((d) => d.name === deckName) ?? DEFAULT_DECK)
  }
  const selectGlobalSimDeck = (deckName: string) => {
    const d = availableDecks.find((x) => x.name === deckName) ?? LANDS_DECK
    setSimDeck(d)
    setSeatConfigs((prev) => prev.map((s) => isSimSeatType(s.type) ? { ...s, deckName: d.name } : s))
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
    if (compatibilityError) {
      setError(compatibilityError)
      return
    }
    setBusy(true)
    setError(null)
    if (isDraftLimited) {
      const setCodes = parseLimitedSetCodes(draftSetsRaw)
      if (setCodes.length === 0) {
        setError(t('errors','draft_no_sets'))
        setBusy(false)
        return
      }
      const limitedOptions = buildLimitedOptions({
        numberBoosters: draftBoosters,
        constructionTime: draftConstructionTime,
        setCodes,
        ...(draftCubeName ? { draftCubeName } : {}),
        ...(isDraftTournamentType(tournamentType) ? { timing: draftTiming } : {}),
      })
      const bannedUsers = bannedUsersRaw.split(',').map((s) => s.trim()).filter(Boolean)
      const tArgs = {
        name: name || `${username}'s table`,
        tournamentType,
        gameType,
        deckType: 'Limited',
        limitedOptions,
        playerTypes: ['HUMAN'],
        password: password.trim() || undefined,
        watchingAllowed: spectatorsAllowed,
        spectatorsAllowed,
        winsNeeded: wins,
        ...(numberRounds > 0 ? { numberRounds } : {}),
        skillLevel,
        rated,
        rollbackTurnsAllowed,
        timeLimit: timeLimit === 'NONE' ? undefined : timeLimit,
        bufferTime: bufferTime === 'NONE' ? undefined : bufferTime,
        minimumRating: minimumRating > 0 ? minimumRating : undefined,
        quitRatio: quitRatio < 100 ? quitRatio : undefined,
        bannedUsers: bannedUsers.length > 0 ? bannedUsers : undefined,
        isSingleMultiplayerGame: singleGame || undefined,
      }
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
        const join = await cmds.joinTournamentTable({
          tableId,
          playerName: username,
          playerType: 'HUMAN',
          skill: mySkill,
        })
        if (!join.ok) {
          const code = (join as { errorCode?: string }).errorCode
          const raw = join.error || code || t('errors','join_table_failed')
          setError(tError(raw, 'joinTournamentTable', code) ?? raw)
          return
        }
      }
      onClose()
      return
    }
    const seatTypes = seatConfigs.map((s) => normalizeSeatType(s.type))
    // fallback para mesas 2p clásicas sin seatConfigs inicializado: usa chips antiguos
    const fallbackTypes = (playerTypesSel.length ? playerTypesSel : [SIM_SEAT]).map(normalizeSeatType)
    const effectiveSeatTypes = seatTypes.length > 0 ? seatTypes : fallbackTypes.slice(0, Math.max(0, numPlayers - (humanSeat ? 1 : 0)))
    const playerTypesFinal = humanSeat ? [HUMAN_SEAT, ...effectiveSeatTypes] : effectiveSeatTypes
    // validar numPlayers coherente con playerTypesFinal
    if (playerTypesFinal.length !== numPlayers) {
      // truncar o rellenar con SIM si hay mismatch (ej. datos persistidos viejos)
      while (playerTypesFinal.length < numPlayers) playerTypesFinal.push(SIM_SEAT)
      while (playerTypesFinal.length > numPlayers) playerTypesFinal.pop()
    }
    const simSeats = effectiveSeatTypes.filter(isSimSeatType).length

    // pre-validación contra la BD de cartas del servidor (humano y asientos SIM)
    // Transformación invisible para Commander: XMage espera comandante en banquillo
    const xmageMyDeck = prepareDeckForXMage(myDeck, deckType, gameType)
    const xmageSimDeck = prepareDeckForXMage(simDeck, deckType, gameType)
    let finalMyDeck = xmageMyDeck
    if (humanSeat) {
      const fixed = await requestDeckValidation(xmageMyDeck)
      if (!fixed) {
        setBusy(false)
        return
      }
      finalMyDeck = fixed
    }
    let finalSimDeck = xmageSimDeck
    if (simSeats > 0) {
      const fixed = await requestDeckValidation(xmageSimDeck)
      if (!fixed) {
        setBusy(false)
        return
      }
      finalSimDeck = fixed
    }

    const simDecksBySeat: typeof finalSimDeck[] = []
    if (simSeats > 0) {
      for (let i = 0; i < effectiveSeatTypes.length; i++) {
        if (isSimSeatType(effectiveSeatTypes[i])) {
          const cfg = seatConfigs[i]
          const deckForSeat = cfg?.deckName ? (availableDecks.find((d) => d.name === cfg.deckName) ?? finalSimDeck as unknown as Deck) : (finalSimDeck as unknown as Deck)
          const xmageDeckForSeat = prepareDeckForXMage(deckForSeat as Deck, deckType, gameType)
          simDecksBySeat.push(xmageDeckForSeat as unknown as typeof finalSimDeck)
        }
      }
      while (simDecksBySeat.length < simSeats) simDecksBySeat.push(finalSimDeck)
    }
    const bannedUsers = bannedUsersRaw.split(',').map((s) => s.trim()).filter(Boolean)
    const seatSkills = effectiveSeatTypes.map((_, i) => seatConfigs[i]?.skill ?? 2)
    const res = await cmds.createTable({
      name: name || `${username}'s table`,
      gameType,
      deckType,
      winsNeeded: wins,
      playerTypes: playerTypesFinal,
      password: password.trim() || undefined,
      skillLevel,
      rated,
      spectatorsAllowed,
      rollbackTurnsAllowed,
      timeLimit: timeLimit === 'NONE' ? undefined : timeLimit,
      bufferTime: bufferTime === 'NONE' ? undefined : bufferTime,
      freeMulligans,
      attackOption: showRangeAttack ? attackOption : undefined,
      range: showRangeAttack ? range : undefined,
      minimumRating: minimumRating > 0 ? minimumRating : undefined,
      quitRatio: quitRatio < 100 ? quitRatio : undefined,
      edhPowerLevel: edhPowerLevel < 100 ? edhPowerLevel : undefined,
      bannedUsers: bannedUsers.length > 0 ? bannedUsers : undefined,
      seatSkills,
      skipInitShuffling,
      skipStartingPlayerChoice,
      limited: isLimitedDeckType(deckType) || undefined,
      mulliganType: mulliganType !== 'GAME_DEFAULT' ? mulliganType : undefined,
      customStartLifeEnabled: customStartLifeEnabled || undefined,
      customStartLife: customStartLifeEnabled ? customStartLife : undefined,
      customStartHandSizeEnabled: customStartHandSizeEnabled || undefined,
      customStartHandSize: customStartHandSizeEnabled ? customStartHandSize : undefined,
      planeChase: planeChase || undefined,
      simDecks: simSeats > 0 ? simDecksBySeat : undefined,
    } as any)

    setBusy(false)
    if (!res.ok) {
      const code = (res as { errorCode?: string }).errorCode
      const raw = res.error || code || t('errors','create_table_failed')
      setError(tError(raw, 'createTable', code) ?? raw)
      return
    }

    const tableId = (res.data as { tableId?: string } | null)?.tableId
    if (humanSeat && tableId) {
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
    setUseDraftTournament,
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
    isLimited,
    isDraftLimited,
    compatibilityError,
    validateStep,
    submit,
    runDemoTable,
  }
}
