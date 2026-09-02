import * as cmds from '../net/commands'
import type { ChatMessageEvent, GameEndInfo, ProxyMessage } from '../net/types'
import { parseGameEvent } from '../game/gameEventParser'
import { parseFeedback, feedbackCards } from '../game/feedback'
import type { FeedbackCard } from '../game/feedback'
import { getState, setState, addLog } from './state'
import type { SideboardCard, SideboardScreenState } from './state'
import { t as tStatic } from '../i18n'
import { awaitCardMeta } from '../cards/cardImages'
import { saveActiveGame, clearActiveGame } from './persistence'
import { attributeStackControllers } from '../game/stackAttribution'
import {
  gameViewFrom, isOlderThanCurrentGame, consolidatePlayables, combatFromSelect,
  isCombatStep, combatChosenFrom, emptyCombat, targetFirstId,
} from './gameUtils'
import type { DraftClientMessage, TournamentView } from '../net/types.generated'

export function handleMessage(msg: ProxyMessage) {
  switch (msg.type) {
    case 'connected':
      setState({ phase: 'lobby', connecting: false, error: null })
      break
    case 'disconnected':
      setState({ phase: 'idle', connecting: false, game: null, gameId: null, gameChatId: null, playableIds: [], playableWindow: null, combat: null, feedback: null, lobby: null, roomChatId: null, sideboardScreen: null })
      break
    case 'info':
      addLog('servidor', msg.message)
      break
    case 'error':
      setState({ error: msg.message })
      addLog('error', msg.message)
      break
    case 'lobby': {
      const s = getState()
      let updatedWatching = s.watchingTable
      if (s.phase === 'spectating_pending' && s.watchingTable) {
        const found = msg.tables.find((t) => t.tableId === s.watchingTable?.tableId)
        if (found) {
          updatedWatching = found
        }
      }
      setState({ lobby: msg, watchingTable: updatedWatching })
      break
    }
    case 'result':
      if (!msg.ok && msg.action !== 'disconnect') {
        const detail = msg.error ?? (typeof msg.data === 'string' ? msg.data : undefined)
        setState({ error: detail ?? `${msg.action} falló` })
      }
      break
    case 'event':
      handleEvent(msg.method, msg.objectId ?? null, msg.data)
      break
  }
}

function handleEvent(method: string, objectId: string | null, data: unknown) {
  const s = getState()

  // Guard: If we are in an active game, ignore game-specific events belonging to another gameId
  const isGameEvent = method.startsWith('GAME_')
  if (s.gameId && objectId && objectId !== s.gameId && isGameEvent && method !== 'START_GAME') {
    return
  }

  // Guard: If we are in the lobby, ignore in-flight trailing game events from closed/stopped games
  if (s.phase === 'lobby' && isGameEvent && method !== 'START_GAME' && method !== 'WATCHGAME') {
    return
  }

  const embeddedGame = gameViewFrom(data)
  if (embeddedGame && !isOlderThanCurrentGame(embeddedGame, objectId, s.game, s.gameId)) {
    const sameGame = !!objectId && objectId === s.gameId
    setState({ game: attributeStackControllers(sameGame ? s.game : null, embeddedGame), phase: 'game', watchingTable: null, gameId: objectId ?? s.gameId })
  }
  if (method !== 'GAME_UPDATE' && method !== 'GAME_UPDATE_AND_INFORM') {
    setState({ events: [...s.events, { method, time: Date.now() }].slice(-12) })
  }
  if (method !== 'GAME_ASK') {
    const feedback = parseFeedback(method, objectId ?? s.gameId, data)
    if (feedback) setState({ feedback })
  }
  switch (method) {
    case 'CHATMESSAGE': {
      const m = data as ChatMessageEvent
      // If we are in the lobby/staging and message is from a game chat, ignore it
      if (s.phase !== 'game' && m.chatId && s.roomChatId && m.chatId !== s.roomChatId) {
        break
      }
      // If we are in a game and message is from another game, ignore it
      if (s.phase === 'game' && m.chatId && s.gameChatId && s.roomChatId && m.chatId !== s.gameChatId && m.chatId !== s.roomChatId) {
        break
      }
      setState({ chatMessages: [...s.chatMessages, m].slice(-300) })
      // Route by XMage messageType (already forwarded by the proxy inside the
      // ChatMessage payload). GAME -> game log, TALK -> chat, STATUS/USER_INFO
      // -> system noise. Fall back to content heuristics when messageType is
      // absent (e.g. the fake test server).
      const mt = m.messageType
      let channel: 'game' | 'chat' | 'system'
      if (mt === 'GAME') channel = 'game'
      else if (mt === 'TALK') channel = 'chat'
      else if (mt) channel = 'system'
      else channel = parseGameEvent(m.message) ? 'game' : (m.username ? 'chat' : 'system')
      addLog(m.username, m.message, objectId ?? undefined, channel)
      break
    }
    case 'SHOW_USERMESSAGE':
    case 'SHOW_USER_MESSAGE': {
      const d = data as { title?: string; message?: string } | string | null
      const text = typeof d === 'string' ? d : (d?.message ?? d?.title ?? JSON.stringify(d))
      if (text) {
        setState({ error: text })
        addLog('servidor', text)
      }
      break
    }
    case 'SERVER_MESSAGE': {
      const text = typeof data === 'string' ? data : JSON.stringify(data)
      addLog('servidor', text)
      break
    }
    case 'JOINED_TABLE': {
      const d = data as { roomId?: string; tableId?: string; currentTableId?: string; parentTableId?: string; tableName?: string; flag?: boolean } | null
      const tableId = d?.currentTableId ?? d?.tableId ?? null
      const name = d?.tableName ?? tableId ?? ''
      addLog('mesa', `${tStatic('lobby','join_human_btn')} "${name}"`)
      if (tableId && (s.phase === 'lobby' || s.phase === 'staging')) {
        setState({ phase: 'staging', stagingTableId: tableId, error: null })
      }
      break
    }
    case 'START_GAME': {
      const d = data as { gameId?: string; tableName?: string } | null
      const isNewGame = !!d?.gameId && d.gameId !== s.gameId
      if (d?.gameId) saveActiveGame(d.gameId)
      setState({ phase: 'game', watchingTable: null, stagingTableId: null, gameId: d?.gameId ?? null, gameChatId: null, gameEnd: null, sideboardScreen: null })
      addLog('partida', `${tStatic('lobby','start_match_btn')}${d?.tableName ? ` (${d.tableName})` : ''}`)
      if (isNewGame) {
        void cmds.joinGame(d!.gameId!)
        void cmds.getGameChatId(d!.gameId!).then((cid) => {
          setState({ gameChatId: cid ?? null })
          if (cid) void cmds.joinChat(cid)
        })
      }
      break
    }
    case 'GAME_INIT':
    case 'GAME_UPDATE':
    case 'GAME_UPDATE_AND_INFORM':
    case 'GAME_SELECT':
    case 'GAME_PLAY_MANA':
      if (objectId) saveActiveGame(objectId)
      if (method === 'GAME_UPDATE_AND_INFORM' && (data as any)?.message) {
        addLog('partida', (data as any).message, objectId ?? undefined)
      }
      if (embeddedGame) {
        const fresh = getState()
        const { ids, window: playableWindow } = consolidatePlayables(
          embeddedGame, method, fresh.feedback, fresh.playableIds, fresh.playableWindow,
        )
        const patch: Partial<typeof s> = { playableIds: ids, playableWindow }
        if (method === 'GAME_INIT') {
          patch.gameEnd = null
          patch.feedback = null
          if (objectId && !fresh.gameChatId) {
            void cmds.getGameChatId(objectId).then((cid) => {
              setState({ gameChatId: cid ?? null })
              if (cid) void cmds.joinChat(cid)
            })
          }
        }
        if (method === 'GAME_SELECT') {
          const selectFeedback = parseFeedback(method, objectId ?? s.gameId, data)
          patch.feedback = selectFeedback ?? null
        } else if ((method === 'GAME_UPDATE' || method === 'GAME_UPDATE_AND_INFORM') && fresh.feedback?.method === 'GAME_PLAY_MANA') {
          if (Object.keys(embeddedGame.stack ?? {}).length > 0) {
            patch.feedback = null
          }
        }
        const combat = method === 'GAME_SELECT' ? combatFromSelect(data, embeddedGame) : null
        patch.combat = combat
        if (!combat && embeddedGame && isCombatStep(embeddedGame)) {
          const mode: 'attack' | 'block' = embeddedGame.step === 'DECLARE_BLOCKERS' ? 'block' : 'attack'
          patch.combat = { ...(s.combat ?? emptyCombat()), mode, chosen: combatChosenFrom(embeddedGame, mode) }
        }
        setState(patch)
      }
      break
    case 'WATCHGAME': {
      if (objectId) {
        saveActiveGame(objectId, undefined, 'watcher')
        void cmds.watchGame(objectId)
        setState({ phase: 'spectating_pending', gameId: objectId, watchingTable: null })
      }
      addLog('partida', `Espectador: mirando la partida ${objectId?.slice(0, 8) ?? ''}…`)
      break
    }
    case 'GAME_INFORM':
    case 'GAME_INFORM_PERSONAL': {
      const d = data as { message?: string } | string | null
      const msg = typeof d === 'string' ? d : d?.message
      if (msg) addLog('partida', msg, objectId ?? undefined)
      break
    }
    case 'GAME_OVER': {
      const d = data as { gameId?: string; winnerName?: string; message?: string } | string | null
      const msg = typeof d === 'string' ? d : (d?.message ?? 'Fin de la partida')
      clearActiveGame()
      addLog('partida', msg, objectId ?? undefined)

      const fresh = getState()
      const me = fresh.game?.players?.find((p) => p.controlled)
      if (!me || !fresh.gameEnd) {
        const syntheticEnd: GameEndInfo = {
          gameInfo: msg,
          matchInfo: msg,
          won: false,
          matchView: {
            endTime: new Date().toISOString(),
            result: msg,
          },
        }
        setState({ gameEnd: syntheticEnd })
      }
      break
    }
    case 'END_GAME_INFO': {
      const end = (data ?? {}) as GameEndInfo
      const matchOver = end.matchView?.endTime != null || /won the match/i.test(end.matchInfo ?? '')
      addLog('partida', matchOver ? (end.matchInfo ?? 'Fin del match') : (end.matchInfo ?? 'Fin de la partida'))
      if (matchOver) {
        clearActiveGame()
        setState({
          game: null,
          gameId: null,
          gameChatId: null,
          playableIds: [],
          playableWindow: null,
          combat: null,
          feedback: null,
          phase: 'lobby',
          gameEnd: end,
        })
      } else {
        setState({ gameEnd: end })
      }
      break
    }
    case 'SIDEBOARD': {
      const d = (data ?? {}) as {
        deck?: { name?: string; cards?: Record<string, Record<string, unknown>>; sideboard?: Record<string, Record<string, unknown>> }
        currentTableId?: string
        parentTableId?: string
        time?: number
        flag?: boolean
      } | null
      const tableId = d?.currentTableId
      if (!tableId) break
      const deckName = d?.deck?.name ?? tStatic('decks','import_placeholder')
      const time = d?.time ?? 180
      const limited = d?.flag === true
      const rawCards = d?.deck?.cards ?? {}
      const rawSide = d?.deck?.sideboard ?? {}
      const resolve = (cards: Record<string, Record<string, unknown>>): Promise<SideboardCard[]> => {
        const entries = Object.entries(cards)
        return Promise.all(entries.map(async ([id, sc]) => {
          const setCode = String(sc.expansionSetCode ?? '')
          const cardNumber = String(sc.cardNumber ?? '')
          const meta = await awaitCardMeta(setCode, cardNumber)
          return {
            instanceId: id,
            setCode,
            cardNumber,
            name: meta?.name ?? `${setCode || '?'}/${cardNumber || '?'}`,
          }
        }))
      }
      void Promise.all([resolve(rawCards), resolve(rawSide)]).then(([maindeck, sideboard]) => {
        const screen: SideboardScreenState = {
          deckName,
          maindeck,
          sideboard,
          tableId,
          parentTableId: d?.parentTableId ?? null,
          timeLeft: time,
          limited,
        }
        setState({ sideboardScreen: screen })
        addLog('partida', `Sideboard: ${maindeck.length} main / ${sideboard.length} side — tienes ${time}s para ajustar`)
        if (s.settings.autoKeepMulligan) {
          const group = (cards: SideboardCard[]) => {
            const map = new Map<string, { cardName: string; setCode: string; cardNumber: string; amount: number }>()
            for (const c of cards) {
              const key = `${c.name}|${c.setCode}|${c.cardNumber}`
              const existing = map.get(key)
              if (existing) {
                existing.amount++
              } else {
                map.set(key, { cardName: c.name, setCode: c.setCode, cardNumber: c.cardNumber, amount: 1 })
              }
            }
            return Array.from(map.values())
          }
          const deck = {
            name: deckName,
            cards: group(maindeck),
            sideboard: group(sideboard),
          }
          void cmds.submitDeck(tableId, deck)
        }
      })
      break
    }
    case 'START_DRAFT': {
      const d = data as { currentTableId?: string } | null
      addLog('torneo', `Draft iniciado${d?.currentTableId ? ` (mesa ${String(d.currentTableId).slice(0, 8)})` : ''}`)
      break
    }
    case 'DRAFT_INIT':
    case 'DRAFT_PICK':
    case 'DRAFT_UPDATE': {
      const msg = data as DraftClientMessage | null
      if (!msg?.draftView) break
      const draftId = objectId ?? 'draft'
      setState({ draft: { draftId, message: msg } })
      if (method === 'DRAFT_INIT') addLog('torneo', `Draft: booster ${msg.draftView.boosterNum} carta ${msg.draftView.cardNum} — ${msg.draftView.setCodes.join(', ')}`)
      else if (method === 'DRAFT_PICK' && msg.draftPickView?.picking) addLog('torneo', `Tu turno de draftear — timeout ${msg.draftPickView.timeout}s`)
      break
    }
    case 'DRAFT_OVER': {
      const draftId = objectId ?? ''
      addLog('torneo', 'Draft terminado — pasa a construcción')
      setState({ draft: null })
      void draftId
      break
    }
    case 'CONSTRUCT': {
      const d = data as { deck?: { name?: string; cards?: Record<string, unknown>; sideboard?: Record<string, unknown> }; currentTableId?: string; parentTableId?: string; time?: number } | null
      const tableId = d?.currentTableId ?? objectId ?? ''
      if (!tableId) break
      const deckName = d?.deck?.name ?? 'Pool'
      const pool = (d?.deck?.cards ?? {}) as Record<string, unknown>
      const time = d?.time ?? 600
      setState({ construct: { deckName, pool, tableId, parentTableId: d?.parentTableId ?? null, timeLeft: time } })
      setState({ draft: null })
      addLog('torneo', `Construcción: pool ${Object.keys(pool).length} cartas — ${time}s`)
      break
    }
    case 'START_TOURNAMENT': {
      const d = data as { currentTableId?: string } | null
      addLog('torneo', `Torneo iniciado${d?.currentTableId ? ` (mesa ${String(d.currentTableId).slice(0, 8)})` : ''}`)
      break
    }
    case 'TOURNAMENT_INIT':
    case 'TOURNAMENT_UPDATE': {
      const view = data as TournamentView | null
      if (!view) break
      const tid = objectId ?? view.tournamentName ?? 'tournament'
      setState({ tournament: { tournamentId: tid, view } })
      addLog('torneo', `${view.tournamentName} — ${view.tournamentState} ${view.runningInfo ?? ''}`.trim())
      break
    }
    case 'TOURNAMENT_OVER': {
      const text = typeof data === 'string' ? data : (data as { message?: string } | null)?.message ?? 'Torneo terminado'
      addLog('torneo', text)
      break
    }
    case 'SHOW_TOURNAMENT': {
      const d = data as { currentTableId?: string } | null
      addLog('torneo', `Viendo torneo ${d?.currentTableId?.slice(0, 8) ?? ''}`)
      break
    }
    case 'REPLAY_GAME': {
      addLog('replay', `Replay disponible: ${objectId?.slice(0, 8) ?? ''}`)
      break
    }
    case 'REPLAY_INIT':
    case 'REPLAY_UPDATE': {
      const gv = gameViewFrom(data)
      if (gv) {
        setState({ replayViewer: { gameView: gv } })
        setState({ game: gv, phase: 'game' })
      }
      break
    }
    case 'REPLAY_DONE': {
      const text = typeof data === 'string' ? data : (data as { message?: string } | null)?.message ?? 'Replay terminado'
      addLog('replay', text)
      setState({ replayViewer: { gameView: null, result: text } })
      break
    }
    case 'GAME_TARGET': {
      const d = data as { message?: string; options?: { targets?: unknown }; gameId?: string } | null
      const question = d?.message ?? ''
      const currentGameId = objectId ?? d?.gameId ?? s.gameId
      const isSpectator = !((s.game?.players ?? []) as { controlled?: boolean }[]).some((p) => p.controlled)
      if ((s.settings.autoKeepMulligan || isSpectator) && /starting player/i.test(question) && currentGameId) {
        const first = targetFirstId(data)
        if (first) {
          void cmds.sendPlayerUUID(first, currentGameId)
          addLog('tú', 'sorteo: elegir jugador inicial (auto)')
          break
        }
      }
      const feedback = parseFeedback(method, currentGameId, data)
      if (feedback) setState({ feedback })
      break
    }
    case 'GAME_ASK': {
      const d = data as { question?: string; message?: string; options?: unknown[]; gameId?: string } | null
      const question = d?.question ?? d?.message ?? ''
      const currentGameId = objectId ?? d?.gameId ?? s.gameId
      const isSpectator = !((s.game?.players ?? []) as { controlled?: boolean }[]).some((p) => p.controlled)
      if ((s.settings.autoKeepMulligan || isSpectator) && /mulligan|keep your hand|keep hand/i.test(question)) {
        if (currentGameId) void cmds.sendPlayerBoolean(false, currentGameId)
        setState({ feedback: null })
        addLog('tú', 'mulligan: mantener (auto)')
      } else {
        const feedback = parseFeedback(method, currentGameId, data)
        if (feedback) setState({ feedback })
        addLog('partida', `¿${question || 'pregunta'}?`)
      }
      break
    }
    case 'USER_REQUEST_DIALOG': {
      const d = data as {
        title?: string
        message?: string
        gameId?: string
        button1Text?: string
        button1Action?: string
        button2Text?: string
        button2Action?: string
        button3Text?: string
        button3Action?: string
      } | null
      const gameId = objectId ?? d?.gameId ?? s.gameId ?? undefined
      const buttons: { text: string; action: string }[] = []
      if (d?.button1Text && d?.button1Action) buttons.push({ text: d.button1Text, action: d.button1Action })
      if (d?.button2Text && d?.button2Action) buttons.push({ text: d.button2Text, action: d.button2Action })
      if (d?.button3Text && d?.button3Action) buttons.push({ text: d.button3Text, action: d.button3Action })
      setState({ userRequest: { title: d?.title ?? 'Solicitud', message: d?.message ?? '', gameId, buttons } })
      addLog('partida', `Solicitud del servidor: ${d?.title ?? ''}`)
      break
    }
    case 'GAME_ERROR': {
      const d = data as { message?: string } | string | null
      const text = typeof d === 'string' ? d : (d?.message ?? JSON.stringify(d))
      if (text) {
        setState({ error: text })
        addLog('error', text, objectId ?? undefined)
      }
      break
    }
    case 'VIEW_LIMITED_DECK': {
      const d = data as { deck?: { cards?: unknown }; cards?: unknown; currentTableId?: string; parentTableId?: string; time?: number } | null
      const view = (d?.deck?.cards ?? d?.cards) as Record<string, unknown> | undefined
      const cards = feedbackCards({ cardsView1: view }) ?? []
      setState({ viewer: { title: tStatic('decks','my_decks'), cards } })
      addLog('partida', 'Viendo mazo limitado')
      break
    }
    case 'VIEW_SIDEBOARD': {
      const d = data as { gameId?: string; playerId?: string } | null
      const g = getState().game
      const player = g?.players?.find((p) => String(p.playerId) === String(d?.playerId))
      const view = (player?.sideboard ?? {}) as Record<string, unknown>
      const cards: FeedbackCard[] = feedbackCards({ cardsView1: view }) ?? []
      setState({ viewer: { title: 'Sideboard', cards } })
      addLog('partida', 'Viendo sideboard')
      break
    }
    case 'GAME_REDRAW_GUI': {
      // El cliente oficial usa esto para forzar un redibujado; el tablero ya
      // reacciona a GAME_UPDATE, así que solo se registra.
      addLog('partida', 'Redibujar GUI')
      break
    }
    default:
      if (method.startsWith('GAME_')) {
        addLog('partida', `evento ${method}`)
      }
  }
}
