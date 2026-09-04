import { useEffect, useState, useMemo } from 'react'
import * as cmds from '../net/commands'
import type { GameTypeInfo } from '../net/commands'
import { setMyDeck, useStore } from '../state/store'
import { getAllAvailableDecks, DEFAULT_DECK, LANDS_DECK, type Deck } from './decks'
import { requestDeckValidation } from './DeckIssuesDialog'
import { useTranslation } from '../i18n'
import { prepareDeckForXMage } from '../decks/deckNormalize'
import './CreateTableDialog.css'

export type CreateTab = 'general' | 'timing' | 'security' | 'seats' | 'dev'

export const TIME_LIMIT_OPTIONS = [
  { label: 'Sin límite (None)', value: 'NONE' },
  { label: '15 Minutos', value: 'MIN__15' },
  { label: '20 Minutos', value: 'MIN__20' },
  { label: '25 Minutos (Estándar)', value: 'MIN__25' },
  { label: '30 Minutos', value: 'MIN__30' },
  { label: '45 Minutos', value: 'MIN__45' },
  { label: '60 Minutos (Largo)', value: 'MIN__60' },
  { label: '90 Minutos', value: 'MIN__90' },
]

export const BUFFER_TIME_OPTIONS = [
  { label: 'Sin buffer adicional', value: 'NONE' },
  { label: '5 Segundos', value: 'SEC__05' },
  { label: '10 Segundos', value: 'SEC__10' },
  { label: '15 Segundos', value: 'SEC__15' },
  { label: '20 Segundos', value: 'SEC__20' },
  { label: '30 Segundos', value: 'SEC__30' },
]

export const DEFAULT_GAME_TYPES: GameTypeInfo[] = [
  { name: 'Two Player Duel', minPlayers: 2, maxPlayers: 2 },
  { name: 'Free For All', minPlayers: 3, maxPlayers: 10 },
  { name: 'Commander Two Player Duel', minPlayers: 2, maxPlayers: 2 },
  { name: 'Commander Free For All', minPlayers: 3, maxPlayers: 10 },
  { name: 'Tiny Leaders Two Player Duel', minPlayers: 2, maxPlayers: 2 },
  { name: 'Canadian Highlander Two Player Duel', minPlayers: 2, maxPlayers: 2 },
  { name: 'Penny Dreadful Commander Free For All', minPlayers: 3, maxPlayers: 10 },
  { name: 'Freeform Commander Two Player Duel', minPlayers: 2, maxPlayers: 2 },
  { name: 'Freeform Commander Free For All', minPlayers: 3, maxPlayers: 10 },
  { name: 'Freeform Unlimited Commander', minPlayers: 2, maxPlayers: 10 },
  { name: 'Oathbreaker Two Player Duel', minPlayers: 2, maxPlayers: 2 },
  { name: 'Oathbreaker Free For All', minPlayers: 3, maxPlayers: 10 },
  { name: 'Brawl Two Player Duel', minPlayers: 2, maxPlayers: 2 },
  { name: 'Brawl Free For All', minPlayers: 3, maxPlayers: 10 },
  { name: 'Momir Basic Two Player Duel', minPlayers: 2, maxPlayers: 2 },
  { name: 'Momir Basic Free For All', minPlayers: 3, maxPlayers: 10 },
  { name: 'Custom Pillar of the Paruns Two Player Duel', minPlayers: 2, maxPlayers: 2 },
]

export const DEFAULT_DECK_TYPES: string[] = [
  'Constructed - Standard',
  'Constructed - Extended',
  'Constructed - Frontier',
  'Constructed - Pioneer',
  'Constructed - Modern',
  'Constructed - Modern - No Banned List',
  'Constructed - Eternal',
  'Constructed - Legacy',
  'Constructed - Vintage',
  'Constructed - Pauper',
  'Constructed - Historic',
  'Constructed - Historical Type 2',
  'Constructed - Super Type 2',
  'Constructed - Australian Highlander',
  'Constructed - Canadian Highlander',
  'Constructed - European Highlander',
  'Constructed - Old School 93/94',
  'Constructed - Old School 93/94 - Italian Rules',
  'Constructed - Old School 93/94 - Channel Fireball Rules',
  'Constructed - Old School 93/94 - EudoGames Rules',
  'Constructed - Old School 93/94 - EC Rules',
  'Constructed - Premodern',
  'Constructed - Freeform',
  'Constructed - Freeform Unlimited',
  'Variant Magic - Commander',
  'Variant Magic - Duel Commander',
  'Variant Magic - MTGO 1v1 Commander',
  'Variant Magic - Centurion Commander',
  'Variant Magic - Tiny Leaders',
  'Variant Magic - Momir Basic',
  'Variant Magic - Penny Dreadful Commander',
  'Variant Magic - Freeform Commander',
  'Variant Magic - Freeform Unlimited Commander',
  'Variant Magic - Brawl',
  'Variant Magic - Oathbreaker',
  'Block Constructed - Amonkhet',
  'Block Constructed - Battle for Zendikar',
  'Block Constructed - Innistrad',
  'Block Constructed - Ixalan',
  'Block Constructed - Kaladesh',
  'Block Constructed - Kamigawa',
  'Block Constructed - Khans of Tarkir',
  'Block Constructed - Lorwyn',
  'Block Constructed - Return to Ravnica',
  'Block Constructed - Scars of Mirrodin',
  'Block Constructed - Shadowmoor',
  'Block Constructed - Shadows over Innistrad',
  'Block Constructed - Shards of Alara',
  'Block Constructed - Theros',
  'Block Constructed - Zendikar',
  'Block Constructed Custom - Star Wars',
  'Limited',
]

export const DEFAULT_PLAYER_TYPES: string[] = [
  'SIM',
  'COMPUTER_MAD',
  'COMPUTER_DRAFT',
]

export const SKILL_LEVEL_OPTIONS = [
  { label: 'Novato', value: 'BEGINNER', icon: '⭐' },
  { label: 'Casual', value: 'CASUAL', icon: '⭐⭐' },
  { label: 'Competitivo', value: 'SERIOUS', icon: '⭐⭐⭐' },
]

export interface LimitedDraftOptions {
  numberBoosters: number
  constructionTime: number
  setCodes: string[]
  draftCubeName?: string
}

export const LIMITED_BOOSTER_OPTIONS = [3, 6] as const
export const CONSTRUCTION_TIME_OPTIONS = [
  { label: '5 minutos', value: 300 },
  { label: '10 minutos', value: 600 },
  { label: '15 minutos', value: 900 },
  { label: '25 minutos', value: 1500 },
] as const

export function buildLimitedOptions(opts: LimitedDraftOptions): Record<string, unknown> {
  return {
    numberBoosters: opts.numberBoosters,
    constructionTime: opts.constructionTime,
    setCodes: opts.setCodes,
    sets: opts.setCodes,
    ...(opts.draftCubeName ? { draftCubeName: opts.draftCubeName } : {}),
  }
}

export function buildDraftTournamentArgs(args: {
  name: string
  tournamentType: string
  gameType: string
  deckType: string
  limitedOptions: LimitedDraftOptions
  playerTypes?: string[]
  password?: string
  watchingAllowed?: boolean
  winsNeeded?: number
}): Record<string, unknown> {
  const limited = buildLimitedOptions(args.limitedOptions)
  return {
    name: args.name,
    tournamentType: args.tournamentType,
    gameType: args.gameType,
    matchType: args.gameType,
    deckType: args.deckType,
    limited: true,
    limitedOptions: limited,
    playerTypes: args.playerTypes ?? ['HUMAN'],
    password: args.password ?? '',
    watchingAllowed: args.watchingAllowed ?? true,
    winsNeeded: args.winsNeeded ?? 1,
  }
}

export function parseLimitedSetCodes(raw: string): string[] {
  return raw.split(/[,\s]+/).map((s) => s.trim().toUpperCase()).filter(Boolean)
}

export const MAX_COMMANDER_PLAYERS = 4
export const MAX_DRAFT_PLAYERS = 8

export function getEffectiveMaxPlayers(gameType: string, gameTypes: GameTypeInfo[], isDraft: boolean): number {
  if (isDraft) return MAX_DRAFT_PLAYERS
  const info = gameTypes.find((g) => g.name === gameType)
  if (info) return info.maxPlayers
  if (gameType.toLowerCase().includes('commander')) return MAX_COMMANDER_PLAYERS
  return 2
}

type WizardStep = { id: CreateTab; icon: string; labelKey: string; titleFallback: string }

const WIZARD_STEPS_BASE: WizardStep[] = [
  { id: 'general', icon: '⚙️', labelKey: 'create_tab_general', titleFallback: 'General' },
  { id: 'timing', icon: '⏱️', labelKey: 'create_tab_timing', titleFallback: 'Tiempos & Reglas' },
  { id: 'security', icon: '🛡️', labelKey: 'create_tab_restrictions', titleFallback: 'Restricciones' },
  { id: 'seats', icon: '🤖', labelKey: 'create_tab_multi', titleFallback: 'Jugadores' },
]

export default function CreateTableDialog({ onClose }: { onClose: () => void }) {
  const { t, tError } = useTranslation()
  const username = useStore((s) => s.conn?.username ?? 'player')
  const storeDeck = useStore((s) => s.myDeck)

  const wizardSteps: WizardStep[] = useMemo(() => {
    const steps = [...WIZARD_STEPS_BASE]
    if (import.meta.env.DEV) steps.push({ id: 'dev', icon: '🛠️', labelKey: '', titleFallback: 'Dev' })
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
  const goNext = () => goToIndex(activeIndex + 1)
  const goPrev = () => goToIndex(activeIndex - 1)
  const isLastStep = activeIndex === wizardSteps.length - 1
  const isFirstStep = activeIndex === 0

  const [gameTypes, setGameTypes] = useState<GameTypeInfo[]>(DEFAULT_GAME_TYPES)
  const [deckTypes, setDeckTypes] = useState<string[]>(DEFAULT_DECK_TYPES)
  const [playerTypes, setPlayerTypes] = useState<string[]>(DEFAULT_PLAYER_TYPES)

  // General tab
  const [name, setName] = useState(`${username}'s table`)
  const [gameType, setGameType] = useState('Two Player Duel')
  const [deckType, setDeckType] = useState('Constructed - Modern')
  const [wins, setWins] = useState(1)
  const [skillLevel, setSkillLevel] = useState<'BEGINNER' | 'CASUAL' | 'SERIOUS'>('CASUAL')
  const [rated, setRated] = useState(false)
  const [useDraftTournament, setUseDraftTournament] = useState(false)
  const [draftSetsRaw, setDraftSetsRaw] = useState('M21')
  const [draftBoosters, setDraftBoosters] = useState<3 | 6>(3)
  const [draftConstructionTime, setDraftConstructionTime] = useState(600)
  const [tournamentType, setTournamentType] = useState('Booster Draft')

  // Timing tab
  const [timeLimit, setTimeLimit] = useState('MIN__25')
  const [bufferTime, setBufferTime] = useState('NONE')
  const [freeMulligans, setFreeMulligans] = useState(0)
  const [attackOption, setAttackOption] = useState('LEFT')
  const [range, setRange] = useState('ALL')

  // Security & Permissions tab
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [spectatorsAllowed, setSpectatorsAllowed] = useState(true)
  const [rollbackTurnsAllowed, setRollbackTurnsAllowed] = useState(true)
  const [minimumRating, setMinimumRating] = useState(0)
  const [quitRatio, setQuitRatio] = useState(100)
  const [edhPowerLevel, setEdhPowerLevel] = useState(100)

  // Seats & Decks tab
  const [humanSeat, setHumanSeat] = useState(true)
  const [availableDecks, setAvailableDecks] = useState<Deck[]>(() => getAllAvailableDecks())
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const mod = await import('../decks/storage')
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
        const [g, d, p] = await Promise.all([
          cmds.getGameTypes().catch(() => []),
          cmds.getDeckTypes().catch(() => []),
          cmds.getPlayerTypes().catch(() => []),
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
          setPlayerTypes(p)
        }
      } catch (err) {
        console.warn('Could not fetch server match types, using defaults', err)
      }
    })()
    return () => {
      active = false
    }
  }, [])

  // Auto-adjust free mulligans hint instead of forcing — keep previous behavior but less aggressive
  useEffect(() => {
    const isMulti = gameType.toLowerCase().includes('commander') || gameType.toLowerCase().includes('free for all')
    if (isMulti && freeMulligans === 0) {
      setFreeMulligans(1)
    }
  }, [gameType])

  const toggleAi = (pt: string) => {
    setPlayerTypesSel((cur) => (cur.includes(pt) ? cur.filter((x) => x !== pt) : [...cur, pt]))
  }

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

  const isLimited = deckType === 'Limited'
  const isDraftLimited = isLimited && useDraftTournament

  const create = async () => {
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
      })
      const tArgs = {
        name: name || `${username}'s table`,
        tournamentType,
        gameType,
        deckType: 'Limited',
        limitedOptions,
        playerTypes: ['HUMAN'],
        password: password.trim() || undefined,
        watchingAllowed: spectatorsAllowed,
        winsNeeded: wins,
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
          skill: 1,
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
    const effectiveMax = getEffectiveMaxPlayers(gameType, effectiveGameTypes, false)
    const maxPlayers = selectedGameTypeInfo?.maxPlayers ?? effectiveMax
    const maxAi = Math.max(0, maxPlayers - (humanSeat ? 1 : 0))
    const aiTypes = (playerTypesSel.length ? playerTypesSel : ['SIM']).slice(0, maxAi)
    const playerTypesFinal = humanSeat ? ['HUMAN', ...aiTypes] : aiTypes
    const simSeats = aiTypes.filter((pt) => pt === 'SIM').length

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
      attackOption: isMultiplayerGame ? attackOption : undefined,
      range: isMultiplayerGame ? range : undefined,
      minimumRating: minimumRating > 0 ? minimumRating : undefined,
      quitRatio: quitRatio < 100 ? quitRatio : undefined,
      edhPowerLevel: edhPowerLevel < 100 ? edhPowerLevel : undefined,
      skipInitShuffling,
      skipStartingPlayerChoice,
      simDecks: simSeats > 0 ? Array.from({ length: simSeats }, () => finalSimDeck) : undefined,
    })

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
        skill: 1,
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


  return (
    <div className="overlay">
      <div className="dialog panel create-table-dialog">
        <div className="create-table-header">
          <div className="create-table-header-title">
            <h2>⚔️ {t('lobby.create_table_btn')}</h2>
            <span className="create-table-subtitle">{t('lobby','create_header_subtitle')}</span>
          </div>
          <button type="button" className="create-dialog-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="wizard-progress-track" aria-hidden>
          <div className="wizard-progress-fill" style={{ width: `${((activeIndex + 1) / wizardSteps.length) * 100}%` }} />
        </div>
        <div className="wizard-step-counter">
          Paso {activeIndex + 1} de {wizardSteps.length} · {wizardSteps[activeIndex]?.icon} {wizardSteps[activeIndex]?.labelKey ? t('lobby', wizardSteps[activeIndex].labelKey as any) : wizardSteps[activeIndex]?.titleFallback}
        </div>

        <nav className="wizard-stepper" aria-label="Pasos de creación de mesa">
          {wizardSteps.map((step, idx) => {
            const isActive = idx === activeIndex
            const isCompleted = idx < activeIndex
            const label = step.labelKey ? t('lobby', step.labelKey as any) : step.titleFallback
            return (
              <button
                key={step.id}
                type="button"
                className={`wizard-step ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
                onClick={() => setActiveTab(step.id)}
                aria-current={isActive ? 'step' : undefined}
                title={label}
              >
                <span className="wizard-step-circle">
                  {isCompleted ? '✓' : idx + 1}
                </span>
                <span className="wizard-step-label">
                  <span className="wizard-step-icon">{step.icon}</span>
                  <span className="wizard-step-text">{label}</span>
                </span>
                {idx < wizardSteps.length - 1 && <span className={`wizard-connector ${isCompleted ? 'done' : ''}`} />}
              </button>
            )
          })}
        </nav>

        <div className="create-table-body">
          {activeTab === 'general' && (
            <div className="create-tab-content">
              <div className="wizard-step-heading">
                <h3>⚙️ {t('lobby','create_tab_general')}</h3>
                <p>Nombre, formato y estructura del match.</p>
              </div>
              <label>
                {t('lobby','create_field_table_name')}
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('lobby','placeholder_table_name')}
                />
              </label>

              <div className="create-grid-2col">
                <label>
                  {t('lobby','create_field_game_type')}
                  <select value={gameType} onChange={(e) => setGameType(e.target.value)}>
                    {effectiveGameTypes.map((g) => (
                      <option key={g.name} value={g.name}>
                        {g.name} ({g.minPlayers}-{g.maxPlayers})
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {t('lobby','create_field_format')}
                  <select value={deckType} onChange={(e) => setDeckType(e.target.value)}>
                    {effectiveDeckTypes.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="field">
                <span>{t('lobby','create_field_wins_needed')}</span>
                <div className="chip-row">
                  {[
                    { label: t('lobby','create_option_wins_bo1'), val: 1 },
                    { label: t('lobby','create_option_wins_bo3'), val: 2 },
                    { label: t('lobby','create_option_wins_bo5'), val: 3 },
                  ].map((w) => (
                    <button
                      key={w.val}
                      type="button"
                      className={`chip ${wins === w.val ? 'on' : ''}`}
                      onClick={() => setWins(w.val)}
                    >
                      {w.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="field">
                <span>{t('lobby','create_field_skill')}</span>
                <div className="chip-row">
                  {SKILL_LEVEL_OPTIONS.map((opt) => {
                    const label = opt.value === 'BEGINNER' ? t('lobby','create_skill_beginner') : opt.value === 'CASUAL' ? t('lobby','create_skill_casual') : t('lobby','create_skill_competitive')
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        className={`chip ${skillLevel === opt.value ? 'on' : ''}`}
                        onClick={() => setSkillLevel(opt.value as any)}
                      >
                        {opt.icon} {label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <label className="toggle-label-row">
                <input
                  type="checkbox"
                  checked={rated}
                  onChange={(e) => setRated(e.target.checked)}
                />
                <div className="toggle-text-block">
                  <span className="toggle-title">⭐ {t('lobby','create_field_rated')}</span>
                  <span className="toggle-desc">Partida puntuada para ranking. Desactívalo para juego casual sin ELO.</span>
                </div>
              </label>

              {deckType === 'Limited' && (
                <div className="create-multiplayer-box" style={{ marginTop: 4 }}>
                  <span className="multiplayer-box-title">🃏 {t('lobby','create_field_draft_type')}</span>
                  <label className="toggle-label-row">
                    <input
                      type="checkbox"
                      checked={useDraftTournament}
                      onChange={(e) => setUseDraftTournament(e.target.checked)}
                    />
                    <div className="toggle-text-block">
                      <span className="toggle-title">Crear como torneo Draft</span>
                      <span className="toggle-desc">Si lo activas, se creará un torneo en lugar de una mesa normal.</span>
                    </div>
                  </label>
                  {useDraftTournament && (
                    <div style={{ marginTop: 10, display: 'grid', gap: 10 }}>
                      <div className="create-grid-2col">
                        <label>
                          {t('lobby','create_field_draft_type')}
                          <select value={tournamentType} onChange={(e) => setTournamentType(e.target.value)}>
                            <option value="Booster Draft">{t('lobby','create_option_booster_draft')}</option>
                            <option value="Sealed">{t('lobby','create_option_sealed')}</option>
                            <option value="Elimination">{t('lobby','create_option_elimination')}</option>
                          </select>
                        </label>
                        <label>
                          {t('lobby', 'create_field_boosters')}
                          <select value={draftBoosters} onChange={(e) => setDraftBoosters(Number(e.target.value) as 3 | 6)}>
                            <option value={3}>{t('lobby', 'create_option_boosters_3')}</option>
                            <option value={6}>{t('lobby', 'create_option_boosters_6')}</option>
                          </select>
                        </label>
                      </div>
                      <label>
                        {t('lobby','create_field_draft_sets')}
                        <input
                          value={draftSetsRaw}
                          onChange={(e) => setDraftSetsRaw(e.target.value)}
                          placeholder={t('lobby','placeholder_draft_sets')}
                        />
                      </label>
                      <label>
                        Tiempo de construcción
                        <select value={draftConstructionTime} onChange={(e) => setDraftConstructionTime(Number(e.target.value))}>
                          {CONSTRUCTION_TIME_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'timing' && (
            <div className="create-tab-content">
              <div className="wizard-step-heading">
                <h3>⏱️ {t('lobby','create_tab_timing')}</h3>
                <p>Relojes, mulligans y reglas de mesa multijugador.</p>
              </div>
              <div className="create-grid-2col">
                <label>
                  {t('lobby','create_field_timing_limit')}
                  <select value={timeLimit} onChange={(e) => setTimeLimit(e.target.value)}>
                    {TIME_LIMIT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </label>

                <label>
                  Buffer de tiempo
                  <select value={bufferTime} onChange={(e) => setBufferTime(e.target.value)}>
                    {BUFFER_TIME_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="field">
                <span>{t('lobby','create_field_free_mulligans')} <em style={{ textTransform: 'none', fontWeight: 400, color: '#9aa3c2' }}>— recomendado 1 para Commander/FFA</em></span>
                <div className="chip-row">
                  {[0, 1, 2, 3].map((m) => (
                    <button
                      key={m}
                      type="button"
                      className={`chip ${freeMulligans === m ? 'on' : ''}`}
                      onClick={() => setFreeMulligans(m)}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {isMultiplayerGame && (
                <div className="create-multiplayer-box">
                  <span className="multiplayer-box-title">👑 {t('lobby','create_tab_multi')}</span>
                  <div className="create-grid-2col">
                    <label>
                      {t('lobby','create_field_attack_option')}
                      <select value={attackOption} onChange={(e) => setAttackOption(e.target.value)}>
                        <option value="LEFT">{t('lobby','create_option_attack_left')}</option>
                        <option value="RIGHT">{t('lobby','create_option_attack_right')}</option>
                        <option value="MULTIPLE">{t('lobby','create_option_attack_multiple')}</option>
                      </select>
                    </label>
                    <label>
                      {t('lobby','create_field_range')}
                      <select value={range} onChange={(e) => setRange(e.target.value)}>
                        <option value="ALL">{t('lobby','create_option_range_all')}</option>
                        <option value="ONE">{t('lobby','create_option_range_one')}</option>
                        <option value="TWO">{t('lobby','create_option_range_two')}</option>
                      </select>
                    </label>
                  </div>
                </div>
              )}
              {!isMultiplayerGame && (
                <div className="wizard-hint-box">Las opciones de ataque y rango aparecen automáticamente al elegir un formato multijugador (Commander / Free For All).</div>
              )}
            </div>
          )}

          {activeTab === 'security' && (
            <div className="create-tab-content">
              <div className="wizard-step-heading">
                <h3>🛡️ {t('lobby','create_tab_restrictions')}</h3>
                <p>Privacidad y filtros de acceso a la mesa.</p>
              </div>
              <label>
                {t('lobby','create_field_password')}
                <div className="password-field-wrap">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t('lobby','placeholder_password')}
                  />
                  <button type="button" className="password-toggle-btn" onClick={() => setShowPassword((v) => !v)} title={showPassword ? 'Ocultar' : 'Mostrar'}>
                    {showPassword ? '🙈' : '👁️'}
                  </button>
                </div>
              </label>

              <div className="create-restrictions-box">
                <span className="restrictions-box-title">🛡️ {t('lobby','create_tab_restrictions')}</span>
                <div className="create-grid-2col">
                  <label>
                    {t('lobby','create_field_min_rating')}
                    <input
                      type="number"
                      min={0}
                      max={3000}
                      step={50}
                      value={minimumRating}
                      onChange={(e) => setMinimumRating(Math.max(0, parseInt(e.target.value, 10) || 0))}
                      placeholder={t('common','all')}
                    />
                    <span className="create-field-hint">
                      {minimumRating > 0 ? `${t('lobby','create_field_min_rating')}: ≥ ${minimumRating}` : t('common','all')}
                    </span>
                  </label>

                  <label>
                    {t('lobby','create_field_quit_ratio')}
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={5}
                      value={quitRatio}
                      onChange={(e) => setQuitRatio(Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0)))}
                      placeholder={t('common','all')}
                    />
                    <span className="create-field-hint">
                      {quitRatio < 100 ? `${t('lobby','create_field_quit_ratio')}: ${quitRatio}%` : t('common','all')}
                    </span>
                  </label>
                </div>

                {isMultiplayerGame && (
                  <div style={{ marginTop: 10 }}>
                    <label>
                      Potencia EDH (solo Commander, 0-100)
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={5}
                        value={edhPowerLevel}
                        onChange={(e) => setEdhPowerLevel(Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0)))}
                        placeholder={t('common','all')}
                      />
                      <span className="create-field-hint">
                        {edhPowerLevel < 100 ? `EDH Power: ${edhPowerLevel}` : t('common','all') + ' — sin límite'}
                      </span>
                    </label>
                  </div>
                )}
              </div>

              <label className="toggle-label-row">
                <input
                  type="checkbox"
                  checked={spectatorsAllowed}
                  onChange={(e) => setSpectatorsAllowed(e.target.checked)}
                />
                <div className="toggle-text-block">
                  <span className="toggle-title">👁️ {t('lobby','create_field_spectators')}</span>
                  <span className="toggle-desc">Permite que otros usuarios observen la partida en vivo.</span>
                </div>
              </label>

              <label className="toggle-label-row">
                <input
                  type="checkbox"
                  checked={rollbackTurnsAllowed}
                  onChange={(e) => setRollbackTurnsAllowed(e.target.checked)}
                />
                <div className="toggle-text-block">
                  <span className="toggle-title">⏪ {t('lobby','create_field_rollback')}</span>
                  <span className="toggle-desc">Permite solicitar rebobinar la partida a un turno anterior.</span>
                </div>
              </label>
            </div>
          )}

          {activeTab === 'seats' && (
            <div className="create-tab-content">
              <div className="wizard-step-heading">
                <h3>🤖 {t('lobby','create_tab_multi')}</h3>
                <p>Tu asiento, tu mazo y los bots rivales.</p>
              </div>
              <div className="create-seats-section">
                <div className="create-seat-box human-seat-box">
                  <div className="seat-box-header">
                    <span className="seat-title">👤 {t('common','player')}</span>
                    <button
                      type="button"
                      className={`chip ${humanSeat ? 'on' : ''}`}
                      onClick={() => setHumanSeat(!humanSeat)}
                    >
                      {humanSeat ? `✓ ${t('common','player')}` : `👁️ ${t('lobby','spectators')}`}
                    </button>
                  </div>
                  {humanSeat && (
                    <label>
                      {t('lobby','active_deck')}
                      <select
                        value={myDeck.name}
                        onChange={(e) =>
                          setMyDeckState(availableDecks.find((d) => d.name === e.target.value) ?? DEFAULT_DECK)
                        }
                      >
                        {availableDecks.map((d) => (
                          <option key={d.name} value={d.name}>
                            {d.name} ({d.cards.reduce((sum, c) => sum + c.amount, 0)} {t('decks','total_cards')})
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  {!humanSeat && <span className="wizard-hint-box">Entrarás como espectador. Podrás unirte luego desde la sala de espera.</span>}
                </div>

                <div className="create-seat-box ai-seat-box">
                  <div className="seat-box-header">
                    <span className="seat-title">🤖 {t('lobby','ai')}</span>
                    {(() => {
                      const effectiveMax = getEffectiveMaxPlayers(gameType, effectiveGameTypes, false)
                      const maxPlayers = selectedGameTypeInfo?.maxPlayers ?? effectiveMax
                      const maxAi = Math.max(0, maxPlayers - (humanSeat ? 1 : 0))
                      const truncated = playerTypesSel.length > maxAi
                      return truncated ? <span className="wizard-warn-badge">⚠️ Máx {maxAi} bots para {gameType}</span> : null
                    })()}
                  </div>
                  <div className="field">
                    <span>{t('lobby','create_tab_multi')}</span>
                    <div className="chip-row">
                      <button
                        type="button"
                        className={playerTypesSel.includes('SIM') ? 'chip on' : 'chip'}
                        onClick={() => toggleAi('SIM')}
                      >
                        🤖 SIM ({t('lobby','ai')})
                      </button>
                      {playerTypes.map((pt) => (
                        <button
                          key={pt}
                          type="button"
                          className={playerTypesSel.includes(pt) ? 'chip on' : 'chip'}
                          onClick={() => toggleAi(pt)}
                        >
                          {pt}
                        </button>
                      ))}
                    </div>
                  </div>

                  {playerTypesSel.includes('SIM') && (
                    <label>
                      Mazo para bots SIM
                      <select
                        value={simDeck.name}
                        onChange={(e) =>
                          setSimDeck(availableDecks.find((d) => d.name === e.target.value) ?? LANDS_DECK)
                        }
                      >
                        {availableDecks.map((d) => (
                          <option key={d.name} value={d.name}>
                            {d.name} ({d.cards.reduce((sum, c) => sum + c.amount, 0)} {t('decks','total_cards')})
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'dev' && (
            <div className="create-tab-content">
              <div className="wizard-step-heading">
                <h3>🛠️ Dev / Test</h3>
                <p>Solo visible en desarrollo. Opciones de test del motor.</p>
              </div>
              <div className="dev-options-notice">
                <span>⚠️ Solo para pruebas locales — no afecta a beta.</span>
              </div>

              <div className="dev-demo-box">
                <h4>Demo IA vs IA</h4>
                <p>Crea una mesa SIM vs SIM y arranca la partida automáticamente para espectar.</p>
                <button
                  type="button"
                  className="primary dev-demo-btn"
                  onClick={async () => {
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
                  }}
                  disabled={busy}
                >
                  ▶ {t('lobby','watch_btn')} ({t('lobby','ai')} vs {t('lobby','ai')})
                </button>
              </div>

              <label className="toggle-label-row">
                <input
                  type="checkbox"
                  checked={skipInitShuffling}
                  onChange={(e) => setSkipInitShuffling(e.target.checked)}
                />
                <div className="toggle-text-block">
                  <span className="toggle-title">🃏 {t('lobby','create_toggle_skip_shuffle')}</span>
                  <span className="toggle-desc">No barajar (útil para tests deterministas).</span>
                </div>
              </label>

              <label className="toggle-label-row">
                <input
                  type="checkbox"
                  checked={skipStartingPlayerChoice}
                  onChange={(e) => setSkipStartingPlayerChoice(e.target.checked)}
                />
                <div className="toggle-text-block">
                  <span className="toggle-title">🎲 {t('lobby','create_toggle_skip_starting')}</span>
                  <span className="toggle-desc">Salta la elección de quién empieza.</span>
                </div>
              </label>
            </div>
          )}
        </div>

        <div className="create-table-summary-strip">
          <span className="summary-pill">{gameType}</span>
          <span className="summary-pill">{deckType}</span>
          <span className="summary-pill">Bo{wins === 1 ? '1' : wins === 2 ? '3' : '5'}</span>
          <span className="summary-pill">{timeLimit === 'NONE' ? t('lobby','create_summary_no_clock') : timeLimit.replace('MIN__', '') + 'm'}</span>
          <span className="summary-pill">{skillLevel === 'BEGINNER' ? t('lobby','create_skill_beginner') : skillLevel === 'CASUAL' ? t('lobby','create_skill_casual') : t('lobby','create_skill_competitive')}</span>
          {isDraftLimited && <span className="summary-pill">🃏 Draft {draftBoosters}× {parseLimitedSetCodes(draftSetsRaw).join(', ') || 'sets'}</span>}
          {isLimited && !isDraftLimited && <span className="summary-pill">{t('lobby','create_summary_limited')}</span>}
          {minimumRating > 0 && <span className="summary-pill">⭐ {t('lobby','create_field_min_rating')}: {minimumRating}</span>}
          {quitRatio < 100 && <span className="summary-pill">🚫 {t('lobby','create_field_quit_ratio')}: {quitRatio}%</span>}
          {password.trim() && <span className="summary-pill security">🔒 {t('lobby','tag_private')}</span>}
          {rated && <span className="summary-pill rated">⭐ {t('lobby','tag_rated')}</span>}
        </div>

        {error && <div className="error-box">⚠️ {tError(error)}</div>}

        <div className="dialog-actions wizard-actions">
          <div className="wizard-actions-left">
            {!isFirstStep && (
              <button type="button" onClick={goPrev} disabled={busy}>
                ← Atrás
              </button>
            )}
            <button type="button" onClick={onClose} disabled={busy}>
              {t('common','cancel')}
            </button>
          </div>
          <div className="wizard-actions-right">
            {!isLastStep ? (
              <button type="button" className="primary" onClick={goNext} disabled={busy}>
                Siguiente →
              </button>
            ) : (
              <button type="button" className="primary create-submit-btn" disabled={busy} onClick={create}>
                {busy ? `${t('lobby','create_table_btn')}…` : isDraftLimited ? `${t('lobby','create_submit_draft')} 🃏` : `${t('lobby','create_table_btn')} 🚀`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
