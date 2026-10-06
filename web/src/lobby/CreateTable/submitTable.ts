import * as cmds from '../../net/commands'
import { setMyDeck } from '../../state/store'
import { DEFAULT_DECK, type Deck } from '../decks'
import { requestDeckValidation } from '../DeckIssuesDialog'
import type { useTranslation } from '../../i18n'
import { prepareDeckForXMage } from '../../decks/deckNormalize'
import { isLimitedDeckType } from '../../decks/formatRules'
import {
  buildLimitedOptions,
  isNativeAiSeatType,
  isSimSeatType,
  normalizeSeatType,
  parseLimitedSetCodes,
} from './constants'
import {
  computeTournamentSeats,
  computeMatchSeats,
  buildTournamentLimitedOptions,
  buildCreateTournamentArgs,
  buildCreateMatchArgs,
  validateDraftSets,
  limitedTourneyHasAiSeats,
  type TableKindResolution,
} from './tableKind'
import { isRandomPacksType } from './RandomPacksSelector'
import type { CreateTableForm } from './types'
import type { DeckJson } from '../../net/types'

type Translation = ReturnType<typeof useTranslation>

/** What the create-table flow reads from the form. */
export type SubmitTableForm = Pick<
  CreateTableForm,
  | 'name' | 'gameType' | 'deckType' | 'wins' | 'skillLevel' | 'rated'
  | 'draftSetsRaw' | 'draftBoosters' | 'draftConstructionTime' | 'draftCubeName' | 'draftTiming'
  | 'numberRounds' | 'singleGame' | 'timeLimit' | 'bufferTime' | 'freeMulligans' | 'mulliganType'
  | 'customStartLifeEnabled' | 'customStartLife' | 'customStartHandSizeEnabled' | 'customStartHandSize'
  | 'planeChase' | 'attackOption' | 'range' | 'password' | 'bannedUsersRaw' | 'spectatorsAllowed'
  | 'rollbackTurnsAllowed' | 'minimumRating' | 'quitRatio' | 'edhPowerLevel' | 'numPlayers'
  | 'seatConfigs' | 'humanSeat' | 'myDeck' | 'simDeck' | 'playerTypesSel' | 'mySkill'
  | 'skipInitShuffling' | 'skipStartingPlayerChoice' | 'showRangeAttack' | 'isDraftLimited'
  | 'isTournament' | 'compatibilityError'
> & {
  username: string
  tableResolution: TableKindResolution
  findDeck: (ref?: string) => Deck | undefined
}

/** How the flow reports back to the dialog. */
export interface SubmitTableIO {
  t: Translation['t']
  tError: Translation['tError']
  setBusy: (v: boolean) => void
  setError: (v: string | null) => void
  onClose: () => void
}

function discardTable(tableId: string) {
  void cmds.removeTable(tableId)
}

/** The deck of a bot seat: its own choice, else the global sim deck, else mine, else the bundled one. */
function resolveSimDeck(f: SubmitTableForm, deckRefValue?: string): Deck | null {
  if (deckRefValue) {
    const found = f.findDeck(deckRefValue)
    if (found) return found
  }
  return f.simDeck ?? f.myDeck ?? DEFAULT_DECK
}

function botName(counter: number, total: number) {
  return counter === 1 && total === 1 ? 'Computer' : `Computer ${counter}`
}

/** Validates the form, creates the table or tournament, seats the bots and then me. */
export async function submitCreateTable(f: SubmitTableForm, io: SubmitTableIO): Promise<void> {
  const { t, setError, setBusy } = io
  if (!f.name.trim()) {
    setError(t('errors','create_table_name_required'))
    return
  }
  if (f.compatibilityError && !f.isDraftLimited) {
    setError(f.compatibilityError)
    return
  }
  if (f.humanSeat && !f.myDeck && !f.isDraftLimited) {
    setError(t('lobby', 'create_err_no_deck'))
    setBusy(false)
    return
  }
  setBusy(true)
  setError(null)
  if (f.isTournament) {
    await submitTournament(f, io)
  } else {
    await submitMatch(f, io)
  }
}

async function submitTournament(f: SubmitTableForm, io: SubmitTableIO): Promise<void> {
  const { t, tError, setError, setBusy } = io
  const { tableResolution, isDraftLimited, deckType, gameType, seatConfigs, password } = f
  const normalizedTournamentType = tableResolution.normalizedTournamentType
  if (tableResolution.kind === 'invalid') {
    setError(t('lobby', 'create_err_bad_tournament_type', { type: tableResolution.errorParam }))
    setBusy(false)
    return
  }
  const { playerTypesFinal, effectiveSeatTypes } = computeTournamentSeats({
    seatConfigs,
    playerTypesSel: f.playerTypesSel,
    numPlayers: f.numPlayers,
    humanSeat: f.humanSeat,
    draft: isDraftLimited,
  })
  if (isDraftLimited && limitedTourneyHasAiSeats(playerTypesFinal)) {
    setError(t('errors', 'draft_bots_no_submit'))
    setBusy(false)
    return
  }

  let limitedOptions: ReturnType<typeof buildLimitedOptions> | undefined
  if (isDraftLimited) {
    const setsError = validateDraftSets(f.draftSetsRaw, f.draftBoosters, {
      cube: f.draftCubeName.trim().length > 0,
      random: isRandomPacksType(normalizedTournamentType),
    })
    if (setsError) {
      setError(t('errors', setsError, {
        need: f.draftBoosters,
        have: parseLimitedSetCodes(f.draftSetsRaw).length,
      }))
      setBusy(false)
      return
    }
    limitedOptions = buildTournamentLimitedOptions({
      draftSetsRaw: f.draftSetsRaw,
      draftBoosters: f.draftBoosters,
      draftConstructionTime: f.draftConstructionTime,
      draftCubeName: f.draftCubeName,
      draftTiming: f.draftTiming,
      tournamentType: normalizedTournamentType,
    })
  }

  let finalMyDeck: Deck | null = null
  if (!isDraftLimited && f.humanSeat && f.myDeck) {
    const fixed = await requestDeckValidation(prepareDeckForXMage(f.myDeck, deckType, gameType))
    if (!fixed) {
      setBusy(false)
      return
    }
    finalMyDeck = fixed
  }

  const tArgs = buildCreateTournamentArgs({
    name: f.name,
    username: f.username,
    tournamentType: normalizedTournamentType,
    gameType,
    deckType,
    draft: isDraftLimited,
    limitedOptions,
    playerTypesFinal,
    password,
    spectatorsAllowed: f.spectatorsAllowed,
    wins: f.wins,
    numberRounds: f.numberRounds,
    skillLevel: f.skillLevel,
    rated: f.rated,
    rollbackTurnsAllowed: f.rollbackTurnsAllowed,
    timeLimit: f.timeLimit,
    bufferTime: f.bufferTime,
    minimumRating: f.minimumRating,
    quitRatio: f.quitRatio,
    bannedUsersRaw: f.bannedUsersRaw,
    singleGame: f.singleGame,
  })
  const res = await cmds.createTournamentTable(tArgs)
  setBusy(false)
  if (!res.ok) {
    const code = res.errorCode
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
      const name = botName(botCounter, tournamentBotSeats.length)
      botCounter++
      let botDeck: Deck | undefined = undefined
      if (!isDraftLimited) {
        const base = resolveSimDeck(f, bot.cfg?.deckName)
        if (base) {
          const fixed = await requestDeckValidation(prepareDeckForXMage(base, deckType, gameType))
          botDeck = fixed ?? undefined
        }
        if (!botDeck) {
          setError(t('lobby', 'create_err_no_deck'))
          discardTable(tableId)
          return
        }
      }
      const joinBot = await cmds.joinTournamentTable({
        tableId,
        playerName: name,
        playerType: normalizeSeatType(bot.type),
        skill: bot.cfg?.skill ?? 2,
        ...(botDeck ? { deck: botDeck, deckType, gameType } : {}),
        password: password.trim() || undefined,
      })
      if (!joinBot.ok) {
        const code = joinBot.errorCode
        const raw = joinBot.error || code || t('errors', 'join_table_failed')
        setError(tError(raw, 'joinTournamentTable', code) ?? raw)
        discardTable(tableId)
        return
      }
    }
    if (f.humanSeat) {
      const join = await cmds.joinTournamentTable({
        tableId,
        playerName: f.username,
        playerType: 'HUMAN',
        skill: f.mySkill,
        ...(finalMyDeck ? { deck: finalMyDeck, deckType, gameType } : {}),
        password: password.trim() || undefined,
      })
      if (finalMyDeck && f.myDeck) {
        setMyDeck(f.myDeck)
      }
      if (!join.ok) {
        const code = join.errorCode
        const raw = join.error || code || t('errors','join_table_failed')
        setError(tError(raw, 'joinTournamentTable', code) ?? raw)
        discardTable(tableId)
        return
      }
    }
  }
  io.onClose()
}

async function submitMatch(f: SubmitTableForm, io: SubmitTableIO): Promise<void> {
  const { t, tError, setError, setBusy } = io
  const { deckType, gameType, seatConfigs, password, humanSeat, myDeck } = f
  const { playerTypesFinal, effectiveSeatTypes } = computeMatchSeats({
    seatConfigs,
    playerTypesSel: f.playerTypesSel,
    numPlayers: f.numPlayers,
    humanSeat,
  })
  const simSeats = effectiveSeatTypes.filter(isSimSeatType).length
  const nativeBotSeats = effectiveSeatTypes
    .map((type, idx) => ({ type, idx, cfg: seatConfigs[idx] }))
    .filter((s) => isNativeAiSeatType(s.type))

  // pre-validación contra la BD de cartas del servidor (humano y asientos SIM)
  // Transformación invisible para Commander: XMage espera comandante en banquillo
  let finalMyDeck: Deck | null = null
  if (humanSeat && myDeck) {
    const fixed = await requestDeckValidation(prepareDeckForXMage(myDeck, deckType, gameType))
    if (!fixed) {
      setBusy(false)
      return
    }
    finalMyDeck = fixed
  }

  let finalSimDeck: Deck | null = null
  if (simSeats > 0) {
    const base = resolveSimDeck(f)
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

  const simDecksBySeat: DeckJson[] = []
  if (simSeats > 0 && finalSimDeck) {
    for (let i = 0; i < effectiveSeatTypes.length; i++) {
      if (isSimSeatType(effectiveSeatTypes[i])) {
        const cfg = seatConfigs[i]
        const deckForSeat = resolveSimDeck(f, cfg?.deckName)
        if (!deckForSeat) {
          setError(t('lobby', 'create_err_no_deck'))
          setBusy(false)
          return
        }
        simDecksBySeat.push(prepareDeckForXMage(deckForSeat, deckType, gameType))
      }
    }
    while (simDecksBySeat.length < simSeats) simDecksBySeat.push(finalSimDeck)
  }

  const nativeBotDecks: Record<number, Deck> = {}
  if (nativeBotSeats.length > 0 && !isLimitedDeckType(deckType)) {
    for (const bot of nativeBotSeats) {
      const base = resolveSimDeck(f, bot.cfg?.deckName)
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
    name: f.name,
    username: f.username,
    gameType,
    deckType,
    wins: f.wins,
    playerTypesFinal,
    seatSkills,
    password,
    skillLevel: f.skillLevel,
    rated: f.rated,
    spectatorsAllowed: f.spectatorsAllowed,
    rollbackTurnsAllowed: f.rollbackTurnsAllowed,
    timeLimit: f.timeLimit,
    bufferTime: f.bufferTime,
    freeMulligans: f.freeMulligans,
    showRangeAttack: f.showRangeAttack,
    attackOption: f.attackOption,
    range: f.range,
    minimumRating: f.minimumRating,
    quitRatio: f.quitRatio,
    edhPowerLevel: f.edhPowerLevel,
    bannedUsersRaw: f.bannedUsersRaw,
    mulliganType: f.mulliganType,
    customStartLifeEnabled: f.customStartLifeEnabled,
    customStartLife: f.customStartLife,
    customStartHandSizeEnabled: f.customStartHandSizeEnabled,
    customStartHandSize: f.customStartHandSize,
    planeChase: f.planeChase,
    simDecks: simDecksBySeat,
    skipInitShuffling: f.skipInitShuffling,
    skipStartingPlayerChoice: f.skipStartingPlayerChoice,
    dev: import.meta.env.DEV,
  }))

  setBusy(false)
  if (!res.ok) {
    const code = res.errorCode
    const raw = res.error || code || t('errors','create_table_failed')
    setError(tError(raw, 'createTable', code) ?? raw)
    return
  }

  const tableId = (res.data as { tableId?: string } | null)?.tableId
  if (tableId) {
    let botCounter = 1
    for (const bot of nativeBotSeats) {
      const name = botName(botCounter, nativeBotSeats.length)
      botCounter++
      const botDeck = nativeBotDecks[bot.idx] ?? finalSimDeck ?? finalMyDeck ?? DEFAULT_DECK
      const joinBot = await cmds.joinTable({
        tableId,
        playerName: name,
        playerType: normalizeSeatType(bot.type),
        skill: bot.cfg?.skill ?? 2,
        deck: botDeck,
        deckType,
        gameType,
        password: password.trim() || undefined,
      })
      if (!joinBot.ok) {
        const code = joinBot.errorCode
        const raw = joinBot.error || code || t('errors', 'join_table_failed')
        setError(tError(raw, 'joinTable', code) ?? raw)
        discardTable(tableId)
        return
      }
    }

    if (humanSeat && finalMyDeck) {
      const join = await cmds.joinTable({
        tableId,
        playerName: f.username,
        playerType: 'HUMAN',
        skill: f.mySkill,
        deck: finalMyDeck,
        deckType,
        gameType,
        password: password.trim() || undefined,
      })
      setMyDeck(myDeck)
      if (!join.ok) {
        const code = join.errorCode
        const raw = join.error || code || t('errors','join_table_failed')
        setError(tError(raw, 'joinTable', code) ?? raw)
        discardTable(tableId)
        return
      }
    }
  }
  io.onClose()
}

/** Dev shortcut: an AI-vs-AI duel that starts at once and is watched. */
export async function runDemoTable(
  opts: { skipInitShuffling: boolean; skipStartingPlayerChoice: boolean },
  io: Pick<SubmitTableIO, 'setBusy' | 'onClose'>,
): Promise<void> {
  io.setBusy(true)
  try {
    const res = await cmds.createTable({
      name: 'Demo IA vs IA',
      gameType: 'Two Player Duel',
      deckType: 'Constructed - Modern',
      winsNeeded: 1,
      playerTypes: ['SIM', 'SIM'],
      simDecks: [DEFAULT_DECK, DEFAULT_DECK],
      skipInitShuffling: opts.skipInitShuffling,
      skipStartingPlayerChoice: opts.skipStartingPlayerChoice,
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
      io.onClose()
    }
  } finally {
    io.setBusy(false)
  }
}
