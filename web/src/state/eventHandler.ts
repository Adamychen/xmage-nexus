import type { ProxyMessage } from '../net/types'
import { parseFeedback } from '../game/feedback'
import { getState, setState, addLog } from './state'
import { translateError } from '../i18n'
import { attributeStackControllers } from '../game/stackAttribution'
import {
  gameViewFrom, isOlderThanCurrentGame,
} from './gameUtils'
import { dispatchGameSounds } from '../audio/gameSoundDispatcher'
import { handleChatMessage, handleShowUserMessage, handleServerMessage } from './events/chat'
import {
  handleJoinedTable, handleStartGame, handleGameUpdate, handleWatchGame,
  handleGameInform, handleGameOver, handleEndGameInfo, handleGameError, handleRedrawGui,
} from './events/game'
import { handleGameTarget, handleGameAsk, handleUserRequestDialog } from './events/prompts'
import { handleSideboard } from './events/sideboard'
import { handleStartDraft, handleDraftUpdate, handleDraftOver, handleConstruct } from './events/draft'
import {
  handleStartTournament, handleTournamentUpdate, handleTournamentOver, handleShowTournament,
} from './events/tournament'
import { handleReplayGame, handleReplayUpdate, handleReplayDone } from './events/replay'
import { handleViewLimitedDeck, handleViewSideboard } from './events/views'

export function handleMessage(msg: ProxyMessage) {
  switch (msg.type) {
    case 'connected':
      setState({ phase: 'lobby', connecting: false, error: null })
      break
    case 'disconnected':
      setState({ phase: 'idle', connecting: false, game: null, gameId: null, gameChatId: null, tableChatId: null, tableChatTableId: null, playableIds: [], playableWindow: null, combat: null, feedback: null, lobby: null, roomChatId: null, sideboardScreen: null })
      break
    case 'info':
      addLog('servidor', msg.message)
      break
    case 'error':
      setState({ error: translateError(msg.message) })
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
    case 'result': {
      if (!msg.ok && msg.action !== 'disconnect') {
        const delegated = new Set(['createTable', 'createTournamentTable', 'joinTable', 'joinTournamentTable', 'watchTable', 'startMatch'])
        if (delegated.has(msg.action)) {
          const detail = msg.error ?? (typeof msg.data === 'string' ? msg.data : undefined) ?? msg.errorCode
          const code = (msg as { errorCode?: string }).errorCode
          if (detail && detail !== 'FAILED' && detail.toLowerCase() !== 'failed') {
            setState({ error: translateError(detail, msg.action, code) })
          } else if (code && code !== 'FAILED') {
            setState({ error: translateError(code, msg.action, code) })
          }
          break
        }
        const detail = msg.error ?? (typeof msg.data === 'string' ? msg.data : undefined) ?? (msg as { errorCode?: string }).errorCode
        const code = (msg as { errorCode?: string }).errorCode
        setState({ error: translateError(detail ?? `${msg.action} falló`, msg.action, code) })
      }
      break
    }
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
    dispatchGameSounds(s.game, embeddedGame, method)
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
      handleChatMessage(data, objectId, s)
      break
    }
    case 'SHOW_USERMESSAGE':
    case 'SHOW_USER_MESSAGE': {
      handleShowUserMessage(data)
      break
    }
    case 'SERVER_MESSAGE': {
      handleServerMessage(data)
      break
    }
    case 'JOINED_TABLE': {
      handleJoinedTable(data, s)
      break
    }
    case 'START_GAME': {
      handleStartGame(data, s)
      break
    }
    case 'GAME_INIT':
    case 'GAME_UPDATE':
    case 'GAME_UPDATE_AND_INFORM':
    case 'GAME_SELECT':
    case 'GAME_PLAY_MANA':
      handleGameUpdate(method, objectId, data, embeddedGame, s)
      break
    case 'WATCHGAME': {
      handleWatchGame(objectId)
      break
    }
    case 'GAME_INFORM':
    case 'GAME_INFORM_PERSONAL': {
      handleGameInform(data, objectId)
      break
    }
    case 'GAME_OVER': {
      handleGameOver(data, objectId)
      break
    }
    case 'END_GAME_INFO': {
      handleEndGameInfo(data)
      break
    }
    case 'SIDEBOARD': {
      handleSideboard(data, s)
      break
    }
    case 'START_DRAFT': {
      handleStartDraft(data)
      break
    }
    case 'DRAFT_INIT':
    case 'DRAFT_PICK':
    case 'DRAFT_UPDATE': {
      handleDraftUpdate(method, objectId, data)
      break
    }
    case 'DRAFT_OVER': {
      handleDraftOver(objectId)
      break
    }
    case 'CONSTRUCT': {
      handleConstruct(data, objectId)
      break
    }
    case 'START_TOURNAMENT': {
      handleStartTournament(data)
      break
    }
    case 'TOURNAMENT_INIT':
    case 'TOURNAMENT_UPDATE': {
      handleTournamentUpdate(objectId, data)
      break
    }
    case 'TOURNAMENT_OVER': {
      handleTournamentOver(data)
      break
    }
    case 'SHOW_TOURNAMENT': {
      handleShowTournament(data)
      break
    }
    case 'REPLAY_GAME': {
      handleReplayGame(objectId)
      break
    }
    case 'REPLAY_INIT':
    case 'REPLAY_UPDATE': {
      handleReplayUpdate(data)
      break
    }
    case 'REPLAY_DONE': {
      handleReplayDone(data)
      break
    }
    case 'GAME_TARGET': {
      handleGameTarget(method, data, objectId, s)
      break
    }
    case 'GAME_ASK': {
      handleGameAsk(method, data, objectId, s)
      break
    }
    case 'USER_REQUEST_DIALOG': {
      handleUserRequestDialog(data, objectId, s)
      break
    }
    case 'GAME_ERROR': {
      handleGameError(data, objectId)
      break
    }
    case 'VIEW_LIMITED_DECK': {
      handleViewLimitedDeck(data)
      break
    }
    case 'VIEW_SIDEBOARD': {
      handleViewSideboard(data)
      break
    }
    case 'GAME_REDRAW_GUI': {
      handleRedrawGui()
      break
    }
    default:
      if (method.startsWith('GAME_')) {
        addLog('partida', `evento ${method}`)
      }
  }
}
